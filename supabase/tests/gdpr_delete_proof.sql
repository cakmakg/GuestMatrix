-- gdpr_delete_proof.sql — Nachweis der ownership-geprüften DSGVO-Löschung (Migration 0008).
-- Beweist, dass owned_submission_media() und soft_delete_submission() das Eigentums-Prädikat
--   (guest_user_id = auth.uid()  OR  tenant_id = current_tenant_id())
-- DURCHSETZEN: ein fremder Gast/Tenant kann weder die media_url lesen (die Zieldatei erkennen)
-- noch deleted_at setzen. Ergänzt den App-Test (tests/delete-submission.test.ts, Reihenfolge) und
-- die Sichtbarkeit aus rls_lockdown_proof.sql (e).
--
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
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Agentur A',current_date,'agency','gallery');

-- Abgeschlossener, freigegebener Beitrag von guest1 auf dem Event von Tenant A:
insert into public.submissions (id, tenant_id, event_id, guest_user_id, media_url, file_type, consent_at, uploaded_at, moderation_flag)
values ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
        '99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444/x.jpg',
        'image', now(), now(), false);

-- TEST-VORBEDINGUNG (belt-and-suspenders): Grants für die API-Rollen. Regulär via 0007_grants.sql
-- und die execute-Grants in 0008; hier idempotent wiederholt, damit der Rollenwechsel auch gegen
-- eine DB ohne diese Migrationen nicht mit 42501 abbricht, bevor die Funktion überhaupt läuft.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;
grant execute on function public.owned_submission_media(uuid) to anon, authenticated;
grant execute on function public.soft_delete_submission(uuid) to anon, authenticated;

-- ═══ owned_submission_media: Lesen der media_url ist eigentumsgebunden ════════════

-- (1) Fremd-Gast (guest2) darf die media_url NICHT sehen → kann die Zieldatei nicht erkennen.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.owned_submission_media('44444444-4444-4444-8444-444444444444'::uuid);
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (1): Fremd-Gast liest 0 media_url (kann Zieldatei nicht erkennen)';
  else raise notice 'FAIL (1): Fremd-Gast liest % media_url', n; end if;
exception when others then reset role; raise notice 'ERR (1): %', sqlerrm; end $$;

-- (2) Eigentümer-Gast (guest1) sieht genau seine eine media_url.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.owned_submission_media('44444444-4444-4444-8444-444444444444'::uuid);
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (2): Eigentümer-Gast liest seine 1 media_url';
  else raise notice 'FAIL (2): Eigentümer-Gast liest % media_url (erwartet 1)', n; end if;
exception when others then reset role; raise notice 'ERR (2): %', sqlerrm; end $$;

-- (3) Fremd-Tenant (op-b / Tenant B) darf die media_url NICHT sehen.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.owned_submission_media('44444444-4444-4444-8444-444444444444'::uuid);
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (3): Fremd-Tenant liest 0 media_url';
  else raise notice 'FAIL (3): Fremd-Tenant liest % media_url', n; end if;
exception when others then reset role; raise notice 'ERR (3): %', sqlerrm; end $$;

-- (4) Eigentümer-Tenant (op-a / Tenant A) sieht die media_url der eigenen Einreichung.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.owned_submission_media('44444444-4444-4444-8444-444444444444'::uuid);
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (4): Eigentümer-Tenant liest die 1 media_url';
  else raise notice 'FAIL (4): Eigentümer-Tenant liest % media_url (erwartet 1)', n; end if;
exception when others then reset role; raise notice 'ERR (4): %', sqlerrm; end $$;

-- ═══ soft_delete_submission: deleted_at zu setzen ist eigentumsgebunden ═══════════

-- (5) Fremd-Gast (guest2) kann NICHT löschen: RPC gibt NULL zurück, deleted_at bleibt ungesetzt.
do $$ declare v uuid; d timestamptz; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  select public.soft_delete_submission('44444444-4444-4444-8444-444444444444'::uuid) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  select deleted_at into d from public.submissions where id='44444444-4444-4444-8444-444444444444';
  if v is null and d is null then raise notice 'PASS (5): Fremd-Gast-Löschung ohne Wirkung (RPC null, deleted_at null)';
  else raise notice 'FAIL (5): Fremd-Gast konnte löschen (rpc=%, deleted_at=%)', v, d; end if;
exception when others then reset role; raise notice 'ERR (5): %', sqlerrm; end $$;

-- (6) Eigentümer-Gast (guest1) löscht: RPC gibt die id zurück, deleted_at ist gesetzt und
--     media_url ist genullt (0011 — kein toter Storage-Pfad in der gelöschten Zeile).
do $$ declare v uuid; d timestamptz; m text; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.soft_delete_submission('44444444-4444-4444-8444-444444444444'::uuid) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  select deleted_at, media_url into d, m from public.submissions where id='44444444-4444-4444-8444-444444444444';
  if v = '44444444-4444-4444-8444-444444444444' and d is not null and m is null
    then raise notice 'PASS (6): Eigentümer-Gast löscht (RPC gibt id, deleted_at gesetzt, media_url genullt)';
  else raise notice 'FAIL (6): Löschung nicht committet/genullt (rpc=%, deleted_at=%, media_url=%)', v, d, m; end if;
exception when others then reset role; raise notice 'ERR (6): %', sqlerrm; end $$;

-- (7) Nach der Löschung: owned_submission_media liefert 0 (deleted_at-Filter) — die Datei ist
--     nicht erneut anvisierbar; ein zweiter Delete ist ein No-op (RPC null, idempotent).
do $$ declare n int; v uuid; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.owned_submission_media('44444444-4444-4444-8444-444444444444'::uuid);
  select public.soft_delete_submission('44444444-4444-4444-8444-444444444444'::uuid) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 and v is null then raise notice 'PASS (7): nach Löschung 0 media_url + zweiter Delete no-op (idempotent)';
  else raise notice 'FAIL (7): nach Löschung media_url=% / zweiter rpc=%', n, v; end if;
exception when others then reset role; raise notice 'ERR (7): %', sqlerrm; end $$;

rollback;
