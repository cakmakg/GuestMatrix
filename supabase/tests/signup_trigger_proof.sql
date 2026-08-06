-- signup_trigger_proof.sql — Nachweis für den handle_new_user-Trigger (0014 → 0015).
-- Ausführen NACH `npx supabase db reset`. Läuft in EINER Transaktion mit ROLLBACK am Ende
-- (keine Daten bleiben zurück). Jede Prüfung meldet PASS/FAIL/ERR via NOTICE.
--
-- Belegt (Sektor-Auswahl bei der Registrierung, 0015):
--   (a) Operator-Signup mit gültigem, AKTIVEM Sektor (brand_name + sector='tourism') → genau 1
--       Tenant mit sector='tourism', plan='free', name = brand_name = Metadaten-Wert.
--   (b) Anonymer Gast (is_anonymous = true) → KEIN Tenant (Pflicht-Guard bleibt erhalten).
--   (c) Nicht-anonymer Nutzer OHNE brand_name → KEIN Tenant (kein Not-Null-Absturz).
--   (d) brand_name vorhanden, sector FEHLT → Beachhead-Default 'tourism' → 1 Tenant (Fehlen ≠ Müll).
--   (e) Müll-Sektor ('hackerman') → Schicht 1 (Trigger-Allowlist) wirft → KEIN Tenant UND KEIN
--       verwaister auth.users-Nutzer (atomarer Rollback in derselben Transaktion).
--   (f) Gültiger, aber DEAKTIVIERTER Sektor ('event') → Schicht 2 (CHECK tenants_sector_check)
--       lehnt ab → KEIN Tenant UND KEIN verwaister Nutzer. Belegt, dass event/real_estate/agency
--       weiterhin CHECK-gesperrt sind (dieser Slice öffnet keinen Sektor).
--
-- Warum DO-Blöcke mit EXCEPTION bei (e)/(f): ein fehlschlagender Insert (RAISE bzw. CHECK) würde
-- sonst die ganze Proof-Transaktion abbrechen. Der Handler rollt zum impliziten Savepoint des
-- Blocks zurück (undo von auth.users-Insert + evtl. Tenant), sodass der Proof weiterläuft und die
-- 0-Zeilen-Assertion greift.

begin;

-- ── Fixtures (a)–(d): Inserts, die ALLE erfolgreich sind (kein RAISE/CHECK-Verstoß) ────────────
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, is_anonymous, created_at, updated_at) values
  -- (a) echter Operator-Signup mit aktivem Sektor
  ('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated',
   'operator@example.com','{"brand_name":"Sunrise Tours","sector":"tourism"}'::jsonb, false, now(), now()),
  -- (b) anonymer Gast
  ('00000000-0000-0000-0000-000000000000','a2222222-2222-4222-8222-222222222222','authenticated','authenticated',
   null,'{}'::jsonb, true, now(), now()),
  -- (c) nicht-anonym, aber ohne brand_name
  ('00000000-0000-0000-0000-000000000000','a3333333-3333-4333-8333-333333333333','authenticated','authenticated',
   'nobrand@example.com','{}'::jsonb, false, now(), now()),
  -- (d) brand_name vorhanden, aber KEIN sector → Default 'tourism'
  ('00000000-0000-0000-0000-000000000000','a4444444-4444-4444-8444-444444444444','authenticated','authenticated',
   'nosector@example.com','{"brand_name":"No Sector Co"}'::jsonb, false, now(), now());

-- ── (a) Operator bekommt genau einen tourism/free-Tenant mit korrektem brand_name ───────
do $$ declare n int; begin
  select count(*) into n from public.tenants
    where user_id = 'a1111111-1111-4111-8111-111111111111'
      and sector = 'tourism' and plan = 'free'
      and brand_name = 'Sunrise Tours' and name = 'Sunrise Tours';
  if n = 1 then raise notice 'PASS (a): Operator-Signup (sector=tourism) → 1 tourism/free-Tenant';
  else raise notice 'FAIL (a): erwartet 1 passenden Tenant, gefunden %', n; end if;
exception when others then raise notice 'ERR (a): %', sqlerrm; end $$;

-- ── (b) Anonymer Gast bekommt KEINEN Tenant ─────────────────────────────────────────────
do $$ declare n int; begin
  select count(*) into n from public.tenants
    where user_id = 'a2222222-2222-4222-8222-222222222222';
  if n = 0 then raise notice 'PASS (b): anonymer Gast → 0 Tenants';
  else raise notice 'FAIL (b): anonymer Gast → % Tenant(s)', n; end if;
exception when others then raise notice 'ERR (b): %', sqlerrm; end $$;

-- ── (c) Nicht-anonym ohne brand_name bekommt KEINEN Tenant (kein Not-Null-Absturz) ──────
do $$ declare n int; begin
  select count(*) into n from public.tenants
    where user_id = 'a3333333-3333-4333-8333-333333333333';
  if n = 0 then raise notice 'PASS (c): Nutzer ohne brand_name → 0 Tenants';
  else raise notice 'FAIL (c): Nutzer ohne brand_name → % Tenant(s)', n; end if;
exception when others then raise notice 'ERR (c): %', sqlerrm; end $$;

-- ── (d) Fehlender Sektor → Default 'tourism' → genau 1 Tenant ────────────────────────────
do $$ declare n int; begin
  select count(*) into n from public.tenants
    where user_id = 'a4444444-4444-4444-8444-444444444444'
      and sector = 'tourism' and plan = 'free' and brand_name = 'No Sector Co';
  if n = 1 then raise notice 'PASS (d): sector fehlt → Default tourism → 1 Tenant';
  else raise notice 'FAIL (d): erwartet 1 tourism-Tenant (Default), gefunden %', n; end if;
exception when others then raise notice 'ERR (d): %', sqlerrm; end $$;

-- ── (e) Müll-Sektor → Schicht 1 (Allowlist) wirft, Insert wird zurückgerollt ─────────────
do $$ begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, is_anonymous, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000','a5555555-5555-4555-8555-555555555555','authenticated','authenticated',
          'junk@example.com','{"brand_name":"Junk Co","sector":"hackerman"}'::jsonb, false, now(), now());
  raise notice 'FAIL (e): Insert mit Müll-Sektor hätte fehlschlagen müssen';
exception when others then
  null; -- erwartet: Trigger-Allowlist (Schicht 1) wirft; Rollback zum Savepoint
end $$;

do $$ declare n_tenant int; n_user int; begin
  select count(*) into n_tenant from public.tenants
    where user_id = 'a5555555-5555-4555-8555-555555555555';
  select count(*) into n_user from auth.users
    where id = 'a5555555-5555-4555-8555-555555555555';
  if n_tenant = 0 and n_user = 0 then
    raise notice 'PASS (e): Müll-Sektor → 0 Tenants UND 0 verwaiste Nutzer (atomarer Rollback)';
  else raise notice 'FAIL (e): Tenants=%, verwaiste Nutzer=%', n_tenant, n_user; end if;
exception when others then raise notice 'ERR (e): %', sqlerrm; end $$;

-- ── (f) Gültiger, aber deaktivierter Sektor 'event' → Schicht 2 (CHECK) lehnt ab ─────────
do $$ begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, is_anonymous, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000','a6666666-6666-4666-8666-666666666666','authenticated','authenticated',
          'momento@example.com','{"brand_name":"Momento","sector":"event"}'::jsonb, false, now(), now());
  raise notice 'FAIL (f): Insert mit deaktiviertem Sektor event hätte fehlschlagen müssen';
exception when others then
  null; -- erwartet: tenants_sector_check (Schicht 2) verletzt; Rollback zum Savepoint
end $$;

do $$ declare n_tenant int; n_user int; begin
  select count(*) into n_tenant from public.tenants
    where user_id = 'a6666666-6666-4666-8666-666666666666';
  select count(*) into n_user from auth.users
    where id = 'a6666666-6666-4666-8666-666666666666';
  if n_tenant = 0 and n_user = 0 then
    raise notice 'PASS (f): deaktivierter Sektor event → 0 Tenants UND 0 verwaiste Nutzer (CHECK-gesperrt)';
  else raise notice 'FAIL (f): Tenants=%, verwaiste Nutzer=%', n_tenant, n_user; end if;
exception when others then raise notice 'ERR (f): %', sqlerrm; end $$;

rollback;
