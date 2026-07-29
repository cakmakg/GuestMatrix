-- rls_lockdown_proof.sql — Isolations- & Lockdown-Nachweis (tourism/tour/gallery).
-- Ausführen NACH `npx supabase db reset`. Läuft in EINER Transaktion mit ROLLBACK am Ende
-- (keine Daten bleiben zurück). Jede Prüfung meldet PASS/FAIL/ERR via NOTICE; unerwartete
-- Fehler werden abgefangen, damit die Transaktion nicht abbricht.

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','op-a@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','op-b@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','guest1@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','88888888-8888-4888-8888-888888888888','authenticated','authenticated','guest2@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, plan) values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Tenant A','Marke A','tourism','free'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Tenant B','Marke B','tourism','free');

insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Tour A',current_date,'tour','gallery');

-- Abgeschlossener, freigegebener Beitrag von guest1 auf dem Event von Tenant A:
insert into public.submissions (id, tenant_id, event_id, guest_user_id, media_url, file_type, consent_at, uploaded_at, moderation_flag)
values ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
        '99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444/x.jpg',
        'image', now(), now(), false);

-- ═══ LOCK-Beweis (CHECK aus 0006) — gilt für JEDE Rolle, kein Auth nötig ═════════
do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','FB',current_date,'tour','feedback');
  raise notice 'FAIL (d): feedback-Event wurde angelegt — Lock greift NICHT!';
exception when check_violation then
  raise notice 'PASS (d): feedback-Zeile abgelehnt — %', sqlerrm;
end $$;

do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','GB',current_date,'tour','guestbook');
  raise notice 'FAIL (lock): guestbook angelegt!';
exception when check_violation then
  raise notice 'PASS (lock): guestbook abgelehnt — %', sqlerrm;
end $$;

do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','STAY',current_date,'stay','gallery');
  raise notice 'FAIL (lock): campaign_type=stay angelegt!';
exception when check_violation then
  raise notice 'PASS (lock): campaign_type=stay abgelehnt — %', sqlerrm;
end $$;

do $$ begin
  insert into public.tenants (user_id,name,brand_name,sector)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ET','E','event');
  raise notice 'FAIL (lock): sector=event angelegt!';
exception when check_violation then
  raise notice 'PASS (lock): sector=event abgelehnt — %', sqlerrm;
end $$;

-- TEST-VORBEDINGUNG (belt-and-suspenders): Tabellen-GRANTs für die API-Rollen.
-- Regulär liefert Migration 0007_grants.sql diese bereits; hier idempotent wiederholt,
-- damit der Nachweis auch gegen eine DB ohne 0007 läuft. Ohne GRANT schlägt der Rollen-
-- wechsel mit 42501 fehl, bevor RLS überhaupt greift.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;

-- ═══ RLS-Isolation (Rolle authenticated via JWT-Claims; alles gekapselt) ═════════

-- (a) Cross-Tenant: Tenant B darf die submission von Tenant A NICHT sehen.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (a): Tenant B sieht 0 fremde submissions';
  else raise notice 'FAIL (a): Tenant B sieht % Zeilen', n; end if;
exception when others then reset role; raise notice 'ERR (a): %', sqlerrm; end $$;

-- (b) Reziprozität: guest2 (ohne Upload) sieht die Galerie NICHT.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions where event_id='33333333-3333-4333-8333-333333333333';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (b): Gast ohne Upload sieht 0 Galerie-Zeilen (Reziprozität)';
  else raise notice 'FAIL (b): Gast ohne Upload sieht % Zeilen', n; end if;
exception when others then reset role; raise notice 'ERR (b): %', sqlerrm; end $$;

-- (b2) Reziprozität: guest1 (mit Upload) sieht die Galerie.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions where event_id='33333333-3333-4333-8333-333333333333';
  reset role; perform set_config('request.jwt.claims','', true);
  if n >= 1 then raise notice 'PASS (b2): Gast nach Upload sieht Galerie (% Zeile/n)', n;
  else raise notice 'FAIL (b2): Gast nach Upload sieht 0'; end if;
exception when others then reset role; raise notice 'ERR (b2): %', sqlerrm; end $$;

-- (c) Gast-Eigentum: guest2 darf keine submission mit fremder guest_user_id anlegen.
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id,event_id,guest_user_id,file_type,consent_at)
    values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999','image',now());
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (c): Fremd-guest_user_id INSERT wurde erlaubt!';
exception when others then reset role;
  raise notice 'PASS (c): Fremd-INSERT blockiert — %', sqlerrm; end $$;

-- (e) DSGVO: soft-deleted Zeile verschwindet aus der Galerie.
update public.submissions set deleted_at = now() where id='44444444-4444-4444-8444-444444444444';
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='33333333-3333-4333-8333-333333333333' and deleted_at is null;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (e): soft-deleted Zeile ist aus der Galerie verschwunden';
  else raise notice 'FAIL (e): gelöschte Zeile noch sichtbar (%)', n; end if;
exception when others then reset role; raise notice 'ERR (e): %', sqlerrm; end $$;

rollback;
