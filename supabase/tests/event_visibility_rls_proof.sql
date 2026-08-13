-- event_visibility_rls_proof.sql — Nachweis für 0021 (Dilim B: events.visibility-Achse).
-- private bleibt das geschlossene 0018-Modell; shared/moderated öffnen den Gästebuch-Lesepfad
-- für ALLE Gäste (kein Reciprocity-Gate, FLOW_MODE_CAPABILITIES.guestbook.reciprocityEnabled=false);
-- moderated zusätzlich gated über moderation_flag (Dilim D dreht dessen DEFAULT erst um).
--
-- Szenarien:
--   (a) private (Regression 0018): guest2 (eigener Gruß auf demselben Event) sieht guest1s privaten
--       Gruß NICHT. Sanity: guest2 sieht den eigenen Gruß.
--   (b) shared, KEIN Reciprocity-Gate: guest3 — OHNE irgendeinen eigenen Beitrag irgendwo — sieht
--       guest1s Gruß auf dem shared-Event.
--   (c) moderated + moderation_flag=false (freigegeben): sichtbar.
--   (d) moderated + moderation_flag=true (nicht freigegeben): weiterhin verborgen.
--   (e) Cross-Tenant auf PRIVATE: ein fremder Operator (Tourismus-Agentur) sieht die privaten Grüße
--       des Event-Tenants nicht. (Für shared/moderated ist ein authentifizierter Fremd-Read
--       GEWOLLT — das ist die Definition von "geteilt"; kein Test dafür nötig.)
--   (f) Tourismus-Regression: public_gallery_select unangetastet; is_shared_guestbook_event liefert
--       für ein gallery-Event FALSE (der neue Helfer öffnet nichts außerhalb von guestbook).
--   (g) CHECK-Sperre: ein NICHT-guestbook-Event mit visibility≠'private' wird abgelehnt.
--   (h) Immutability: der Tenant kann visibility NICHT per UPDATE ändern (RLS-Ablehnung), andere
--       Spalten (z. B. description) bleiben weiterhin aktualisierbar.
--   (i) Default: ein neu angelegtes wedding-Event ohne expliziten Wert hat visibility='private'.
--   (j) Insert-Pfad: der Operator kann visibility beim ANLEGEN (nicht nur als Seed) auf
--       'moderated' setzen — nur UPDATE ist gesperrt, nicht INSERT.
--
-- Ausführen NACH `npx supabase db reset`. EINE Transaktion mit ROLLBACK am Ende.

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','op-wedding@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','op-agency-v@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','guest1-v@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-444444444444','authenticated','authenticated','guest2-v@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555555','authenticated','authenticated','guest3-v@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, business_type, plan) values
  ('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Wedding Co V','Marke Wedding V','event',null,'free'),
  ('bbbbbbbb-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','Agentur V','Marke Agentur V','tourism','agency','free');

-- Drei wedding/guestbook-Events (je eine Sichtbarkeitsstufe) + ein agency/gallery-Event (Regression).
insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode, visibility) values
  ('e1e10000-0000-4000-8000-000000000001','aaaaaaaa-1111-4111-8111-111111111111','Hochzeit Privat',current_date,'wedding','guestbook','private'),
  ('e2e20000-0000-4000-8000-000000000002','aaaaaaaa-1111-4111-8111-111111111111','Hochzeit Geteilt',current_date,'wedding','guestbook','shared'),
  ('e3e30000-0000-4000-8000-000000000003','aaaaaaaa-1111-4111-8111-111111111111','Hochzeit Moderiert',current_date,'wedding','guestbook','moderated'),
  ('9a110000-0000-4000-8000-00000000009a','bbbbbbbb-2222-4222-8222-222222222222','Agentur-Galerie V',current_date,'agency','gallery','private');

insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag, guest_name, comment) values
  -- private: guest1 + guest2 (guest2 hat selbst einen Gruß → prüft echte Gate-Ablehnung, kein leeres Ergebnis)
  ('50000000-0000-4000-8000-000000000001','aaaaaaaa-1111-4111-8111-111111111111','e1e10000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333',null,null,now(),now(),false,'Guest1','PRIVATE-SECRET-G1'),
  ('50000000-0000-4000-8000-000000000002','aaaaaaaa-1111-4111-8111-111111111111','e1e10000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444',null,null,now(),now(),false,'Guest2','PRIVATE-SECRET-G2'),
  -- shared: nur guest1 postet
  ('50000000-0000-4000-8000-000000000003','aaaaaaaa-1111-4111-8111-111111111111','e2e20000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333',null,null,now(),now(),false,'Guest1','SHARED-MSG-G1'),
  -- moderated: eine freigegebene (flag=false), eine nicht freigegebene (flag=true) Zeile
  ('50000000-0000-4000-8000-000000000004','aaaaaaaa-1111-4111-8111-111111111111','e3e30000-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333',null,null,now(),now(),false,'Guest1','MODERATED-APPROVED'),
  ('50000000-0000-4000-8000-000000000005','aaaaaaaa-1111-4111-8111-111111111111','e3e30000-0000-4000-8000-000000000003','44444444-4444-4444-8444-444444444444',null,null,now(),now(),true,'Guest2','MODERATED-HIDDEN'),
  -- Gallery-Regression: guest1 hat ein Medium auf der Agentur-Galerie.
  ('50000000-0000-4000-8000-000000000006','bbbbbbbb-2222-4222-8222-222222222222','9a110000-0000-4000-8000-00000000009a','33333333-3333-4333-8333-333333333333','image','bbbbbbbb-2222-4222-8222-222222222222/9a110000-0000-4000-8000-00000000009a/50000000-0000-4000-8000-000000000006/x.jpg',now(),now(),false,null,null);

-- TEST-VORBEDINGUNG: Grants für die API-Rollen (idempotent; regulär via 0007).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;

-- ═══ (a) private (Regression 0018): guest2 sieht guest1s privaten Gruß NICHT ═══
do $$ declare n int; n_own int; begin
  perform set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='e1e10000-0000-4000-8000-000000000001' and comment='PRIVATE-SECRET-G1';
  select count(*) into n_own from public.submissions
    where event_id='e1e10000-0000-4000-8000-000000000001' and comment='PRIVATE-SECRET-G2';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 and n_own = 1 then raise notice 'PASS (a): private bleibt geschlossen — guest2 sieht guest1 NICHT, sich selbst schon';
  else raise notice 'FAIL (a): fremd=% (soll 0), eigen=% (soll 1)', n, n_own; end if;
exception when others then reset role; raise notice 'ERR (a): %', sqlerrm; end $$;

-- ═══ (b) shared, KEIN Reciprocity-Gate: guest3 (nirgends ein eigener Beitrag) sieht guest1 ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='e2e20000-0000-4000-8000-000000000002' and comment='SHARED-MSG-G1';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (b): shared öffnet den Lesepfad OHNE Reciprocity-Gate (guest3 hat nie etwas gepostet)';
  else raise notice 'FAIL (b): guest3 sieht den shared-Gruß nicht (n=%)', n; end if;
exception when others then reset role; raise notice 'ERR (b): %', sqlerrm; end $$;

-- ═══ (c) moderated + freigegeben (moderation_flag=false): sichtbar ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='e3e30000-0000-4000-8000-000000000003' and comment='MODERATED-APPROVED';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (c): moderated + moderation_flag=false ist sichtbar';
  else raise notice 'FAIL (c): freigegebener moderated-Gruß nicht sichtbar (n=%)', n; end if;
exception when others then reset role; raise notice 'ERR (c): %', sqlerrm; end $$;

-- ═══ (d) moderated + NICHT freigegeben (moderation_flag=true): weiterhin verborgen ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='e3e30000-0000-4000-8000-000000000003' and comment='MODERATED-HIDDEN';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (d): moderated + moderation_flag=true bleibt verborgen';
  else raise notice 'FAIL (d): nicht freigegebener moderated-Gruß ist sichtbar (n=%)', n; end if;
exception when others then reset role; raise notice 'ERR (d): %', sqlerrm; end $$;

-- ═══ (e) Cross-Tenant auf PRIVATE: fremder Operator sieht nichts ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='e1e10000-0000-4000-8000-000000000001';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (e): fremder Operator sieht die privaten Gästebuch-Grüße NICHT';
  else raise notice 'FAIL (e): Cross-Tenant-Leck bei private — % Zeile(n)', n; end if;
exception when others then reset role; raise notice 'ERR (e): %', sqlerrm; end $$;

-- ═══ (f) Tourismus-Regression: Galerie unangetastet + Helfer öffnet dort nichts ═══
do $$ declare n int; v_shared boolean; begin
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='9a110000-0000-4000-8000-00000000009a';
  reset role; perform set_config('request.jwt.claims','', true);
  select public.is_shared_guestbook_event('9a110000-0000-4000-8000-00000000009a') into v_shared;
  if n >= 1 and v_shared = false then
    raise notice 'PASS (f): Galerie weiterhin sichtbar (%), is_shared_guestbook_event dort FALSE', n;
  else raise notice 'FAIL (f): galerie-n=% (soll >=1), is_shared_guestbook_event=% (soll false)', n, v_shared; end if;
exception when others then reset role; raise notice 'ERR (f): %', sqlerrm; end $$;

-- ═══ (g) CHECK-Sperre: Nicht-guestbook-Event mit visibility≠'private' wird abgelehnt ═══
do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode,visibility)
    values ('bbbbbbbb-2222-4222-8222-222222222222','Illegal Shared Gallery',current_date,'agency','gallery','shared');
  raise notice 'FAIL (g): agency/gallery-Event mit visibility=shared wurde angelegt!';
exception when check_violation then raise notice 'PASS (g): CHECK lehnt visibility=shared für flow_mode<>guestbook ab — %', sqlerrm;
  when others then raise notice 'ERR (g): %', sqlerrm; end $$;

-- ═══ (h) Immutability: visibility ist per UPDATE NICHT änderbar, andere Spalten schon ═══
do $$ declare n_desc int; begin
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  set local role authenticated;

  begin
    update public.events set visibility = 'shared' where id = 'e1e10000-0000-4000-8000-000000000001';
    raise exception 'no_rls_error';
  exception
    when others then
      if sqlerrm = 'no_rls_error' then raise notice 'FAIL (h-visibility): UPDATE von visibility wurde NICHT abgelehnt!';
      else raise notice 'PASS (h-visibility): visibility-UPDATE per RLS abgelehnt — %', sqlerrm; end if;
  end;

  update public.events set description = 'Aktualisierte Beschreibung' where id = 'e1e10000-0000-4000-8000-000000000001';
  get diagnostics n_desc = row_count;

  reset role; perform set_config('request.jwt.claims','', true);
  if n_desc = 1 then raise notice 'PASS (h-other): andere Spalten (description) bleiben aktualisierbar';
  else raise notice 'FAIL (h-other): description-UPDATE row_count=% (soll 1)', n_desc; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'ERR (h): %', sqlerrm; end $$;

-- ═══ (i) Default: neues wedding-Event ohne expliziten Wert hat visibility='private' ═══
do $$ declare v_visibility text; begin
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (id,tenant_id,name,date,campaign_type,flow_mode)
    values ('60000000-0000-4000-8000-000000000001','aaaaaaaa-1111-4111-8111-111111111111','Ohne explizite Sichtbarkeit',current_date,'wedding','guestbook');
  select visibility into v_visibility from public.events where id = '60000000-0000-4000-8000-000000000001';
  reset role; perform set_config('request.jwt.claims','', true);
  if v_visibility = 'private' then raise notice 'PASS (i): Default ohne expliziten Wert ist private';
  else raise notice 'FAIL (i): visibility=%', v_visibility; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'ERR (i): %', sqlerrm; end $$;

-- ═══ (j) Insert-Pfad: der Operator kann visibility beim ANLEGEN auf 'moderated' setzen ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode,visibility)
    values ('aaaaaaaa-1111-4111-8111-111111111111','Live Moderiert',current_date,'wedding','guestbook','moderated');
  get diagnostics n = row_count;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (j): Operator kann visibility beim Anlegen wählen (nur UPDATE ist gesperrt)';
  else raise notice 'FAIL (j): Insert mit visibility=moderated row_count=%', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (j): Insert mit visibility=moderated abgelehnt — %', sqlerrm; end $$;

rollback;
