-- 0015_signup_sector_selection.sql
-- Sektor wird bei der Registrierung GEWÄHLT (statt fest 'tourism' in 0014). Die Wahl reist
-- via raw_user_meta_data->>'sector' mit (aus options.data.sector der signUp-Server-Action)
-- und wird vom Trigger gelesen. Der Sektor ist damit an die Registrierung gebunden und danach
-- unveränderlich (kein UPDATE-Pfad, siehe unten).
--
-- Zwei unabhängige Validierungs-Schichten (Defense-in-Depth):
--   Schicht 1 — Trigger-Allowlist: nur echte, designte Sektor-IDs (Spiegel von SECTOR_TUPLE in
--     lib/sectors/types.ts). Ein VORHANDENER, aber unbekannter Wert (Müll wie 'hackerman') wird
--     mit RAISE abgewiesen. Diese Schicht greift auch, wenn die Server-Action + Zod umgangen
--     werden (direkter auth.signUp-Aufruf mit dem anon-Key und gefälschten Metadaten).
--   Schicht 2 — DB-CHECK tenants_sector_check (0006, = 'tourism'): lehnt jeden gültigen, aber
--     (noch) DEAKTIVIERTEN Sektor ab (real_estate/event/agency). Dieser CHECK bleibt hier
--     UNVERÄNDERT — diese Migration ist nur der Signup-Mechanismus, sie öffnet keinen Sektor.
--
-- Beide Schichten laufen in DERSELBEN Transaktion wie der GoTrue-Insert: ein RAISE (Schicht 1)
-- oder eine CHECK-Verletzung (Schicht 2) rollt den auth.users-Insert atomar zurück — es bleibt
-- KEIN verwaister Nutzer ohne Tenant (dieselbe Atomizitäts-Garantie wie in 0014).
--
-- Fehlt der Sektor ganz (null — z. B. Test-Fixtures, künftige admin-erstellte Nutzer), gilt der
-- Beachhead-Default 'tourism'. Fehlen ≠ Müll: nur ein vorhandener, unbekannter Wert wird
-- abgewiesen. (Gleiches Muster wie der brand_name-Guard.)
--
-- Immutabilität: tenants hat KEINE UPDATE-Policy, die einem Kunden das Ändern von sector
-- erlaubt — deshalb ist der Sektor nach der Registrierung faktisch unveränderlich. WARNUNG:
-- Wird künftig eine UPDATE-Policy auf tenants ergänzt, MUSS sie sector per WITH CHECK schützen
-- (sonst bricht die Immutabilität). Vollständige Notiz: docs/extension-points.md.
--
-- Voraussetzung: 0001–0014 sind angewendet. Idempotent (create or replace function).

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_brand  text := new.raw_user_meta_data->>'brand_name';
  v_sector text := new.raw_user_meta_data->>'sector';
begin
  -- Gäste (anonyme Auth) bekommen NIE einen Tenant. Pflicht-Guard.
  if new.is_anonymous then
    return new;
  end if;

  -- Nur echte Operator-Registrierungen tragen brand_name in raw_user_meta_data. Fehlt es,
  -- wird kein Tenant provisioniert.
  if v_brand is null then
    return new;
  end if;

  -- Schicht 1: Sektor-Allowlist (Spiegel von SECTOR_TUPLE, lib/sectors/types.ts).
  if v_sector is null then
    v_sector := 'tourism';
  elsif v_sector not in ('tourism', 'real_estate', 'event', 'agency') then
    raise exception 'handle_new_user: invalid sector %', v_sector;
  end if;

  -- Schicht 2 folgt implizit über tenants_sector_check (0006) beim Insert.
  insert into public.tenants (user_id, name, brand_name, sector, plan)
  values (new.id, v_brand, v_brand, v_sector, 'free');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
