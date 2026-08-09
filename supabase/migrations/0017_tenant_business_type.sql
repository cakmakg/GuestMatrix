-- 0017_tenant_business_type.sql
-- Turizm-Tenant-Unterrolle `business_type` (hotel | agency) + DB-seitige Sicherheitsgrenze.
--
-- Problem: Innerhalb des tourism-Sektors gibt es zwei getrennte Geschäftsmodelle — Hotels
-- (Feedback zum Aufenthalt) und Reiseagenturen (Foto-Galerie + Feedback). Bisher durfte JEDER
-- tourism-Tenant BEIDE Kampagnentypen anlegen (agency UND stay). Dieser Slice trennt sie und
-- ERZWINGT die Trennung in der DB (nicht nur in der UI): ein Hotel kann ausschließlich `stay`,
-- eine Agentur ausschließlich `agency` anlegen. Die Grenze ist eine RLS-WITH-CHECK-Policy —
-- ein direkter INSERT unter Umgehung des Dashboards wird von Postgres abgewiesen.
--
-- KEIN Sektor-Split: `tenants.sector` bleibt = 'tourism' (0006 unverändert). `business_type` ist
-- eine UNTERROLLE innerhalb des Sektors. Düngung/Immobilien bleiben dormant (CHECK-gesperrt).
--
-- Namensraum-Hinweis: `business_type` (Tenant: hotel|agency) und `campaign_type` (Event:
-- agency|stay) sind GETRENNT. Die Abbildung ist NICHT die Identität:
--   business_type=hotel  → campaign_type=stay
--   business_type=agency → campaign_type=agency
-- (`agency` steht in beiden Räumen, `hotel`≠`stay`.) Die Abbildung lebt an EINER Stelle in der
-- DB (current_tenant_allows_campaign) und spiegelt lib/sectors/ — wie der campaign_type-CHECK.
--
-- Reihenfolge zwingend: Spalte → Vor-Zustand/Konflikt-Check → Backfill → CHECK → Helfer →
-- Policies → Trigger. Der Supabase-Runner umschließt die Datei in EINER Transaktion; ein
-- Fehler (z. B. Konflikt-RAISE) rollt alles atomar zurück (kein Halbzustand).
--
-- Voraussetzung: 0001..0016 sind angewendet. Idempotent (add column if not exists; constraint/
-- policy/function drop+recreate; Backfill ist nach dem ersten Lauf ein No-op).

-- ── 1) Spalte ─────────────────────────────────────────────────────────────────
alter table public.tenants add column if not exists business_type text;

-- ── 2) Vor-Zustand sichtbar machen + Konflikt atomar abbrechen ─────────────────
-- Statt blind zu klassifizieren: erst den echten Bestand melden (im Cloud-Apply-Log sichtbar).
-- Klassifikationsregel (nach dem tour→agency-Remodel 0016 sind Alt-„tour" bereits `agency`):
--   hat agency-Events  → agency        hat stay-Events → hotel
--   hat KEINE Events    → 'agency' (Beachhead-Default; per Betreiber via Admin änderbar)
-- Der EINZIGE mehrdeutige Fall ist ein Tenant mit BEIDEN Typen: dann ließe sich keine der beiden
-- Kampagnen-Historien mit einer einzigen business_type widerspruchsfrei abbilden. Solche Tenants
-- brechen die Migration ab (RAISE) — bewusst, damit kein inkonsistenter Zustand entsteht, in dem
-- die spätere UPDATE-WITH-CHECK das Archivieren eigener Alt-Events blockieren würde.
do $$
declare
  v_total       int;
  v_agency_only int;
  v_stay_only   int;
  v_both        int;
  v_none        int;
  v_conflict    text;
begin
  select count(*) into v_total from public.tenants where sector = 'tourism';

  with per_tenant as (
    select t.id,
           bool_or(e.campaign_type = 'agency') as has_agency,
           bool_or(e.campaign_type = 'stay')   as has_stay
    from public.tenants t
    left join public.events e on e.tenant_id = t.id
    where t.sector = 'tourism'
    group by t.id
  )
  select
    count(*) filter (where has_agency and not coalesce(has_stay, false)),
    count(*) filter (where has_stay   and not coalesce(has_agency, false)),
    count(*) filter (where has_agency and has_stay),
    count(*) filter (where has_agency is null and has_stay is null)
  into v_agency_only, v_stay_only, v_both, v_none
  from per_tenant;

  raise notice '[0017] tourism-Tenants=%: agency-only=%, stay-only=%, beide=%, ohne-Events=% (ohne-Events→Default agency)',
    v_total, v_agency_only, v_stay_only, v_both, v_none;

  if v_both > 0 then
    select string_agg(t.id::text, ', ') into v_conflict
    from public.tenants t
    where t.sector = 'tourism'
      and exists (select 1 from public.events e where e.tenant_id = t.id and e.campaign_type = 'agency')
      and exists (select 1 from public.events e where e.tenant_id = t.id and e.campaign_type = 'stay');
    raise exception
      '[0017] % Tenant(s) haben BEIDE Kampagnentypen (agency & stay): %. Vor dem Anwenden manuell auflösen (business_type-Absicht wählen und die Events des anderen Typs archivieren/verschieben, oder in zwei Tenants trennen), dann erneut ausführen. Abbruch, um einen inkonsistenten business_type↔campaign_type-Zustand zu vermeiden.',
      v_both, v_conflict;
  end if;
end $$;

-- ── 3) Backfill (nur tourism; non-tourism gibt es nicht, sector-CHECK = tourism) ──
update public.tenants t set business_type = coalesce(
  (select case
            when bool_or(e.campaign_type = 'agency') then 'agency'
            when bool_or(e.campaign_type = 'stay')   then 'hotel'
            else null
          end
   from public.events e where e.tenant_id = t.id),
  'agency')
where t.sector = 'tourism' and t.business_type is null;

-- ── 4) CHECK (Schicht 2, Defense-in-Depth wie 0015) ────────────────────────────
-- tourism ⟹ business_type ∈ {hotel,agency} (NOT NULL erzwungen); nicht-tourism ⟹ NULL.
-- WICHTIG für die NULL-Sicherheit der Policy unten: dieser CHECK macht (sector='tourism' AND
-- business_type IS NULL) UNMÖGLICH. Ein NULL-business_type kann daher nur einem (künftigen,
-- derzeit gesperrten) NICHT-tourism-Tenant gehören — dort greift die business_type-Grenze
-- bewusst nicht (der campaign_type dieser Sektoren wird über events_campaign_type_check geregelt).
-- Neuer Sektor mit eigenen business_types → diesen CHECK erweitern (docs/extension-points.md).
alter table public.tenants drop constraint if exists tenants_business_type_check;
alter table public.tenants
  add constraint tenants_business_type_check
  check (
    (sector = 'tourism' and business_type in ('hotel', 'agency'))
    or (sector <> 'tourism' and business_type is null)
  );

-- ── 5) Helfer ──────────────────────────────────────────────────────────────────
-- Zustandslesende Helfer: security definer + leerer search_path + stable (Muster wie
-- current_tenant_id() aus 0001; definer nötig, um tenants unter RLS zu lesen).
create or replace function public.current_tenant_business_type()
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select business_type from public.tenants where user_id = auth.uid()
$$;

create or replace function public.current_tenant_sector()
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select sector from public.tenants where user_id = auth.uid()
$$;

-- Die WITH-CHECK-Grenze in EINER Funktion (security definer + stable + search_path=''):
-- liest die business_type des aktuellen Tenants und bildet sie auf den erlaubten campaign_type ab.
--   NULL (nicht-tourism)  → true  (keine Grenze; kann per CHECK nie einem tourism-Tenant gehören)
--   hotel                 → nur 'stay'
--   agency                → nur 'agency'
--   unbekannt (non-null)  → false (Deny-by-Default für einen künftig noch nicht abgebildeten Wert)
create or replace function public.current_tenant_allows_campaign(p_campaign_type text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select case
           when bt.v is null    then true
           when bt.v = 'hotel'  then p_campaign_type = 'stay'
           when bt.v = 'agency' then p_campaign_type = 'agency'
           else false
         end
  from (select public.current_tenant_business_type() as v) bt
$$;

-- ── 6) SICHERHEITSGRENZE: events INSERT/UPDATE WITH CHECK ───────────────────────
-- Ownership (0001) PLUS business_type↔campaign_type. UPDATE trägt WITH CHECK, sonst würde die
-- USING-Bedingung implizit als Check dienen — deshalb Ownership hier erneut. So kann ein Hotel
-- weder ein agency-Event ANLEGEN noch ein bestehendes stay-Event per UPDATE auf agency umbiegen.
-- (Nach dem Konflikt-Abbruch in Schritt 2 passen alle Alt-Events zu ihrer business_type; das
-- Archivieren/Reaktivieren eigener Events per UPDATE bleibt also möglich.)
drop policy if exists "tenant_insert_own_events" on public.events;
create policy "tenant_insert_own_events"
  on public.events for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_tenant_allows_campaign(campaign_type)
  );

drop policy if exists "tenant_update_own_events" on public.events;
create policy "tenant_update_own_events"
  on public.events for update
  using (tenant_id = public.current_tenant_id())
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_tenant_allows_campaign(campaign_type)
  );

-- ── 7) Immutabilität: sector + business_type gegen Kunden-UPDATE sperren ─────────
-- 0001 legte "tenant_update_own" NUR mit USING an (kein WITH CHECK). Damit konnte ein Kunde per
-- direktem PostgREST-UPDATE Spalten seiner eigenen Zeile ändern — für business_type wäre das ein
-- Loch (Hotel setzt sich auf agency und legt danach agency-Events an). Diese Policy schließt es:
-- der Kunde (authenticated) darf sector/business_type NICHT ändern. Der Betreiber (service_role,
-- BYPASSRLS Admin-Client) kann weiterhin zuweisen/umstellen — genau die „Betreiber weist zu"-Regel
-- aus CLAUDE.md. (Schließt zugleich die bislang ungesicherte sector-Immutabilität; siehe 0015-Notiz
-- und docs/extension-points.md.)
drop policy if exists "tenant_update_own" on public.tenants;
create policy "tenant_update_own"
  on public.tenants for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and sector = public.current_tenant_sector()
    and business_type is not distinct from public.current_tenant_business_type()
  );

-- ── 8) Signup: business_type bei der Registrierung wählen (0015-Muster erweitert) ─
-- Der Kunde wählt bei der Registrierung eine Geschäftsart; die Server-Action übersetzt sie in
-- (sector, business_type) und schickt beides via raw_user_meta_data. Der Trigger validiert
-- unabhängig (Schicht 1) — Client wird nicht vertraut.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_brand    text := new.raw_user_meta_data->>'brand_name';
  v_sector   text := new.raw_user_meta_data->>'sector';
  v_business text := new.raw_user_meta_data->>'business_type';
begin
  -- Gäste (anonyme Auth) bekommen NIE einen Tenant. Pflicht-Guard.
  if new.is_anonymous then
    return new;
  end if;

  -- Nur echte Operator-Registrierungen tragen brand_name. Fehlt es → kein Tenant.
  if v_brand is null then
    return new;
  end if;

  -- Schicht 1a: Sektor-Allowlist (Spiegel von SECTOR_TUPLE, lib/sectors/types.ts).
  if v_sector is null then
    v_sector := 'tourism';
  elsif v_sector not in ('tourism', 'real_estate', 'event', 'agency') then
    raise exception 'handle_new_user: invalid sector %', v_sector;
  end if;

  -- Schicht 1b: business_type-Allowlist, an den Sektor gebunden (Spiegel von lib/sectors/).
  -- tourism verlangt hotel|agency (Fehlen ≠ Müll → Default agency); andere Sektoren tragen NULL.
  if v_sector = 'tourism' then
    if v_business is null then
      v_business := 'agency';
    elsif v_business not in ('hotel', 'agency') then
      raise exception 'handle_new_user: invalid business_type %', v_business;
    end if;
  else
    v_business := null;
  end if;

  -- Schicht 2 folgt implizit über tenants_sector_check (0006) + tenants_business_type_check (0017).
  insert into public.tenants (user_id, name, brand_name, sector, business_type, plan)
  values (new.id, v_brand, v_brand, v_sector, v_business, 'free');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
