-- business_type_boundary_proof.sql — DB-Sicherheitsgrenze business_type↔campaign_type (0017).
-- Ausführen NACH `npx supabase db reset`. Läuft in EINER Transaktion mit ROLLBACK am Ende
-- (keine Daten bleiben zurück). Jede Prüfung meldet PASS/FAIL/ERR via NOTICE; unerwartete
-- Fehler werden abgefangen, damit die Transaktion nicht abbricht.
--
-- Belegt:
--   (a) KRITISCH: Hotel-Tenant versucht — unter Umgehung des Dashboards, direkt mit dem RLS-Client
--       (Rolle authenticated) — ein agency-Event zu INSERTEN → RLS-WITH-CHECK weist ab. Das ist
--       der eigentliche Sicherheitsbeweis (nicht der UI-Filter). campaign_type='agency' ist ein
--       GÜLTIGER Wert (0016-CHECK) — die Ablehnung kommt allein von der business_type-Grenze.
--   (b) Agentur-Tenant INSERT stay-Event → abgewiesen.
--   (c) Hotel-Tenant legt sein eigenes stay-Event an → gelingt.
--   (d) Agentur-Tenant legt sein eigenes agency-Event an → gelingt.
--   (e) Cross-Tenant-Isolation hält weiter (RLS-Regression): Agentur sieht 0 fremde Events.
--   (e2) Immutabilität: Hotel-Tenant kann seine eigene business_type NICHT auf agency umbiegen
--        (tenants-UPDATE-WITH-CHECK) — sonst wäre die Grenze in einem Schritt umgehbar.
--   (f) Backfill: Alt-Tenants (business_type NULL) werden korrekt klassifiziert und ihre Events
--       bleiben erhalten (agency-Event→agency, stay-Event→hotel, ohne Events→Default agency).
--   (g) Konflikt-Erkennung: ein Tenant mit BEIDEN Typen wird erkannt (die Migration bräche ab).
--   (h) NULL-Sicherheit: ein (simulierter) NICHT-tourism-Tenant (business_type NULL) darf sein
--       eigenes Event anlegen — die Grenze bricht turismus-fremde Sektoren NICHT und NULL ist
--       kein Loch (tourism+NULL ist per tenants_business_type_check ohnehin unmöglich).

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000001','authenticated','authenticated','hotel@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000002','authenticated','authenticated','agency@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, business_type, plan) values
  ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Hotel A','Hotel A','tourism','hotel','free'),
  ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Agentur B','Agentur B','tourism','agency','free');

-- Ein Hotel-Event + ein abgeschlossener Gast-Beitrag (für die Cross-Tenant-Isolation in (e)).
-- events sind BEWUSST öffentlich lesbar (public_select_events, Gäste-Galerie); die tenant-private
-- Isolation greift auf submissions — genau wie in rls_lockdown_proof.sql.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-0000000000c1','authenticated','authenticated','guest-hotel@example.com',now(),now());
insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Hotel-Feedback',current_date,'stay','feedback');
insert into public.submissions (id, tenant_id, event_id, guest_user_id, media_url, file_type, consent_at, uploaded_at, moderation_flag) values
  ('d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-0000000000c1','b0000000-0000-4000-8000-000000000001/x/y/z.jpg','image',now(),now(),false);

-- TEST-VORBEDINGUNG (belt-and-suspenders): Tabellen-GRANTs (regulär via 0007). Ohne GRANT
-- schlägt der Rollenwechsel mit 42501 fehl, bevor RLS greift.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;

-- ═══ (a) KRITISCH: Hotel INSERT agency-Event → RLS weist ab ══════════════════════
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('b0000000-0000-4000-8000-000000000001','Hotel macht Agentur',current_date,'agency','gallery');
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (a): Hotel durfte ein agency-Event anlegen — GRENZE GREIFT NICHT!';
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'PASS (a): Hotel→agency-Event abgewiesen (RLS-Grenze) — %', sqlerrm; end $$;

-- ═══ (b) Agentur INSERT stay-Event → RLS weist ab ════════════════════════════════
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('b0000000-0000-4000-8000-000000000002','Agentur macht Hotel',current_date,'stay','feedback');
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (b): Agentur durfte ein stay-Event anlegen — GRENZE GREIFT NICHT!';
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'PASS (b): Agentur→stay-Event abgewiesen (RLS-Grenze) — %', sqlerrm; end $$;

-- ═══ (c) Hotel legt sein eigenes stay-Event an → gelingt ═════════════════════════
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('b0000000-0000-4000-8000-000000000001','Aufenthalt Juni',current_date,'stay','feedback');
  select count(*) into n from public.events
    where tenant_id='b0000000-0000-4000-8000-000000000001' and name='Aufenthalt Juni' and campaign_type='stay';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (c): Hotel legt eigenes stay-Event an';
  else raise notice 'FAIL (c): erwartet 1 stay-Event, gefunden %', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'ERR (c): %', sqlerrm; end $$;

-- ═══ (d) Agentur legt ihr eigenes agency-Event an → gelingt ══════════════════════
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('b0000000-0000-4000-8000-000000000002','Reise Sommer',current_date,'agency','gallery');
  select count(*) into n from public.events where tenant_id='b0000000-0000-4000-8000-000000000002' and campaign_type='agency';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (d): Agentur legt eigenes agency-Event an';
  else raise notice 'FAIL (d): erwartet 1 agency-Event, gefunden %', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'ERR (d): %', sqlerrm; end $$;

-- ═══ (e) Cross-Tenant-Isolation: Agentur sieht 0 fremde (Hotel-)Submissions ═══════
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions where tenant_id='b0000000-0000-4000-8000-000000000001';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (e): Agentur sieht 0 fremde Submissions (Cross-Tenant-RLS hält)';
  else raise notice 'FAIL (e): Agentur sieht % fremde Submissions', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'ERR (e): %', sqlerrm; end $$;

-- ═══ (e2) Immutabilität: Hotel kann business_type NICHT auf agency umbiegen ═══════
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  update public.tenants set business_type='agency' where user_id='a0000000-0000-4000-8000-000000000001';
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (e2): Hotel durfte business_type ändern — Immutabilität GEBROCHEN!';
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'PASS (e2): business_type-Änderung durch Kunden abgewiesen — %', sqlerrm; end $$;

do $$ declare v text; begin
  select business_type into v from public.tenants where user_id='a0000000-0000-4000-8000-000000000001';
  if v = 'hotel' then raise notice 'PASS (e2b): business_type unverändert (hotel)';
  else raise notice 'FAIL (e2b): business_type ist jetzt %', v; end if;
exception when others then raise notice 'ERR (e2b): %', sqlerrm; end $$;

-- ═══ (f)/(g) Backfill-Logik + Konflikt-Erkennung (als Owner, CHECK temporär weg) ══
-- Alt-Zustand simulieren: Tenants mit business_type NULL (wie vor 0017) + verschiedene Events.
alter table public.tenants drop constraint if exists tenants_business_type_check;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-0000000000f1','authenticated','authenticated','legacy-agency@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-0000000000f2','authenticated','authenticated','legacy-stay@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-0000000000f3','authenticated','authenticated','legacy-none@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-0000000000f4','authenticated','authenticated','legacy-both@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, business_type, plan) values
  ('b0000000-0000-4000-8000-0000000000f1','a0000000-0000-4000-8000-0000000000f1','L-Agency','L-Agency','tourism',null,'free'),
  ('b0000000-0000-4000-8000-0000000000f2','a0000000-0000-4000-8000-0000000000f2','L-Stay','L-Stay','tourism',null,'free'),
  ('b0000000-0000-4000-8000-0000000000f3','a0000000-0000-4000-8000-0000000000f3','L-None','L-None','tourism',null,'free'),
  ('b0000000-0000-4000-8000-0000000000f4','a0000000-0000-4000-8000-0000000000f4','L-Both','L-Both','tourism',null,'free');

insert into public.events (tenant_id,name,date,campaign_type,flow_mode) values
  ('b0000000-0000-4000-8000-0000000000f1','A',current_date,'agency','gallery'),
  ('b0000000-0000-4000-8000-0000000000f2','S',current_date,'stay','feedback'),
  ('b0000000-0000-4000-8000-0000000000f4','A2',current_date,'agency','gallery'),
  ('b0000000-0000-4000-8000-0000000000f4','S2',current_date,'stay','feedback');

-- (g) Konflikt-Erkennung (dieselbe Logik wie die Migration): der L-Both-Tenant wird gefunden.
do $$ declare n int; begin
  with per_tenant as (
    select t.id,
           bool_or(e.campaign_type='agency') as has_agency,
           bool_or(e.campaign_type='stay')   as has_stay
    from public.tenants t left join public.events e on e.tenant_id=t.id
    where t.sector='tourism' group by t.id
  )
  select count(*) into n from per_tenant where has_agency and has_stay;
  if n >= 1 then raise notice 'PASS (g): Konflikt-Erkennung findet % Tenant(s) mit beiden Typen (Migration bräche ab)', n;
  else raise notice 'FAIL (g): both-Typ-Tenant nicht erkannt'; end if;
exception when others then raise notice 'ERR (g): %', sqlerrm; end $$;

-- Backfill: exakt die UPDATE-Anweisung aus Migration 0017.
update public.tenants t set business_type = coalesce(
  (select case
            when bool_or(e.campaign_type = 'agency') then 'agency'
            when bool_or(e.campaign_type = 'stay')   then 'hotel'
            else null end
   from public.events e where e.tenant_id = t.id),
  'agency')
where t.sector = 'tourism' and t.business_type is null;

-- CHECK wieder setzen — validiert alle (jetzt non-null) Zeilen; gelingt nur, wenn der Backfill
-- lückenlos war.
alter table public.tenants add constraint tenants_business_type_check
  check ((sector='tourism' and business_type in ('hotel','agency')) or (sector<>'tourism' and business_type is null));

do $$ declare v_ag text; v_st text; v_no text; n_events int; begin
  select business_type into v_ag from public.tenants where id='b0000000-0000-4000-8000-0000000000f1';
  select business_type into v_st from public.tenants where id='b0000000-0000-4000-8000-0000000000f2';
  select business_type into v_no from public.tenants where id='b0000000-0000-4000-8000-0000000000f3';
  select count(*) into n_events from public.events
    where tenant_id in ('b0000000-0000-4000-8000-0000000000f1','b0000000-0000-4000-8000-0000000000f2','b0000000-0000-4000-8000-0000000000f4');
  if v_ag='agency' and v_st='hotel' and v_no='agency' and n_events=4 then
    raise notice 'PASS (f): Backfill korrekt (agency→agency, stay→hotel, none→agency) + 4 Events erhalten';
  else raise notice 'FAIL (f): agency=%, stay=%, none=%, events=%', v_ag, v_st, v_no, n_events; end if;
exception when others then raise notice 'ERR (f): %', sqlerrm; end $$;

-- ═══ (h) NULL-Sicherheit: NICHT-tourism-Tenant (business_type NULL) darf INSERTen ═
-- Künftigen Sektor simulieren: sector- und campaign_type-CHECK temporär lockern.
alter table public.tenants drop constraint if exists tenants_sector_check;
alter table public.events drop constraint if exists events_campaign_type_check;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-0000000000e1','authenticated','authenticated','wedding@example.com',now(),now());
insert into public.tenants (id, user_id, name, brand_name, sector, business_type, plan) values
  ('b0000000-0000-4000-8000-0000000000e1','a0000000-0000-4000-8000-0000000000e1','Momento','Momento','event',null,'free');

do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('b0000000-0000-4000-8000-0000000000e1','Hochzeit',current_date,'wedding','gallery');
  select count(*) into n from public.events where tenant_id='b0000000-0000-4000-8000-0000000000e1';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (h): NICHT-tourism-Tenant (business_type NULL) legt eigenes Event an — Grenze bricht turismus-fremde Sektoren nicht';
  else raise notice 'FAIL (h): non-tourism-Tenant konnte kein Event anlegen (n=%)', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (h): non-tourism INSERT abgewiesen (NULL sollte KEINE Grenze sein) — %', sqlerrm; end $$;

rollback;
