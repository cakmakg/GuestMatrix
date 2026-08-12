-- service_recovery_proof.sql — Nachweis zu Migration 0020 (`submissions.resolved_at`).
--
-- Behauptung der Migration: die neue Spalte braucht KEINE eigene Policy, weil
-- tenant_update_submissions (0001) UPDATE bereits tenant-gebunden abdeckt und Gäste auf
-- submissions überhaupt keine UPDATE-Bahn haben. Genau das wird hier geprüft statt geglaubt:
--
--   (a) eigener Tenant  → darf resolved_at setzen              (1 Zeile)
--   (b) fremder Tenant  → sieht/ändert die Zeile nicht          (0 Zeilen)
--   (c) Gast (Eigentümer des Beitrags) → kann NICHT markieren   (0 Zeilen)
--   (d) Gast über attach_feedback (0010) → rating/comment ja, resolved_at bleibt NULL
--
-- Ausführen NACH `npx supabase db reset`. EINE Transaktion mit ROLLBACK am Ende.

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','op-a@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','op-b@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','guest1@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, business_type, plan) values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Tenant A','Marke A','tourism','hotel','free'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Tenant B','Marke B','tourism','hotel','free');

insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Hotel-Feedback',current_date,'stay','feedback');

-- Eine kritische Rückmeldung von guest1 — der Fall, den Service Recovery adressiert.
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag, rating, comment) values
  ('f1f1f1f1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','99999999-9999-4999-8999-999999999999',null,null,now(),now(),false,1,'Zimmer war nicht sauber');

-- TEST-VORBEDINGUNG: Grants für die API-Rollen (idempotent; regulär via 0007).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;

-- ═══ (a) Eigener Tenant markiert als erledigt ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  set local role authenticated;
  with upd as (
    update public.submissions set resolved_at = now()
    where id='f1f1f1f1-1111-4111-8111-111111111111' returning 1
  ) select count(*) into n from upd;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (own): Tenant markiert eigenen Beitrag als erledigt';
  else raise notice 'FAIL (own): % statt 1 Zeile aktualisiert', n; end if;
exception when others then reset role; raise notice 'ERR (own): %', sqlerrm; end $$;

-- ═══ (b) Fremder Tenant darf die Zeile NICHT anfassen ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
  set local role authenticated;
  with upd as (
    update public.submissions set resolved_at = null
    where id='f1f1f1f1-1111-4111-8111-111111111111' returning 1
  ) select count(*) into n from upd;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (foreign): fremder Tenant ändert resolved_at NICHT';
  else raise notice 'FAIL (foreign): LECK — % fremde Zeile(n) aktualisiert', n; end if;
exception when others then reset role; raise notice 'ERR (foreign): %', sqlerrm; end $$;

-- ═══ (c) Der Gast, dem der Beitrag gehört, kann sich NICHT selbst als erledigt markieren ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  with upd as (
    update public.submissions set resolved_at = null
    where id='f1f1f1f1-1111-4111-8111-111111111111' returning 1
  ) select count(*) into n from upd;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (guest): Gast hat keine UPDATE-Bahn auf resolved_at';
  else raise notice 'FAIL (guest): Gast hat % Zeile(n) aktualisiert', n; end if;
exception when others then reset role; raise notice 'ERR (guest): %', sqlerrm; end $$;

-- ═══ (d) attach_feedback (0010) bleibt die einzige Gast-Schreibbahn — und rührt resolved_at nicht an ═══
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag)
values ('c1c1c1c1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','99999999-9999-4999-8999-999999999999',null,null,now(),now(),false);

do $$ declare r int; res timestamptz; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  perform public.attach_feedback('c1c1c1c1-1111-4111-8111-111111111111'::uuid, 2::smallint, 'Naja');
  reset role; perform set_config('request.jwt.claims','', true);
  select rating, resolved_at into r, res from public.submissions where id='c1c1c1c1-1111-4111-8111-111111111111';
  if r = 2 and res is null then raise notice 'PASS (attach): Gast setzt rating, resolved_at bleibt NULL';
  else raise notice 'FAIL (attach): rating=%, resolved_at=%', r, res; end if;
exception when others then reset role; raise notice 'ERR (attach): %', sqlerrm; end $$;

-- ═══ Sanity: der partielle Index deckt die Frage „offene Punkte dieses Tenants" ab ═══
do $$ declare n int; begin
  select count(*) into n from pg_indexes
    where schemaname='public' and indexname='submissions_open_resolution_idx';
  if n = 1 then raise notice 'PASS (index): submissions_open_resolution_idx existiert';
  else raise notice 'FAIL (index): Index fehlt'; end if;
end $$;

rollback;
