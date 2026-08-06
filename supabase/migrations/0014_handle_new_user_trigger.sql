-- 0014_handle_new_user_trigger.sql
-- Self-Service-Registrierung: Tenant-Provisionierung per DB-Trigger.
--
-- Bisher legte die Server-Action den Tenant privilegiert über den Admin-Client an und
-- musste bei Fehlern den Auth-Nutzer wieder löschen (deleteUser). Stattdessen erledigt
-- das jetzt ein AFTER-INSERT-Trigger auf auth.users: läuft in DERSELBEN Transaktion wie
-- der GoTrue-Insert, sodass ein fehlgeschlagener Tenant-Insert den Auth-Nutzer atomar
-- zurückrollt — kein verwaister Nutzer ohne Tenant, ohne Cleanup-Code.
--
-- SECURITY DEFINER + leerer search_path (Härtung gegen search_path-Hijacking, wie
-- current_tenant_id() in 0001). Der Definer (Migrations-Owner) umgeht RLS; tenants hat
-- bewusst KEINE INSERT-Policy, daher ist der Trigger der einzige Weg, einen Tenant
-- anzulegen.
--
-- Sektor ist NICHT wählbar: fest 'tourism' (Beachhead), plan 'free'. Beides bleibt
-- innerhalb der CHECKs aus 0006/0005.
--
-- Voraussetzung: 0001–0013 sind angewendet (tenants.sector aus 0003, tenants.plan aus 0005).
-- Idempotent (create or replace function; drop trigger if exists).

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- Gäste (anonyme Auth) bekommen NIE einen Tenant. Pflicht-Guard.
  if new.is_anonymous then
    return new;
  end if;

  -- Nur echte Operator-Registrierungen tragen brand_name in raw_user_meta_data. Fehlt es
  -- (z. B. Test-Fixtures, künftige admin-erstellte Nutzer), wird kein Tenant provisioniert.
  if new.raw_user_meta_data->>'brand_name' is null then
    return new;
  end if;

  insert into public.tenants (user_id, name, brand_name, sector, plan)
  values (
    new.id,
    new.raw_user_meta_data->>'brand_name',
    new.raw_user_meta_data->>'brand_name',
    'tourism',
    'free'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
