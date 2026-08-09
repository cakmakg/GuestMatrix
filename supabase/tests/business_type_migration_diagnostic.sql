-- business_type_migration_diagnostic.sql — READ-ONLY Vor-Prüfung für Migration 0017.
-- VOR dem Anwenden von 0017 (besonders in der Cloud) ausführen, um den echten Bestand zu sehen.
-- Nur SELECTs — schreibt nichts, ändert nichts. Kein BEGIN/ROLLBACK nötig.
--
-- Ziel: die Klassifikation NICHT blind ansetzen. Zeigt je tourism-Tenant, welche campaign_type-
-- Events existieren (nach dem tour→agency-Remodel 0016 sind Alt-„tour" bereits `agency`) und wie
-- 0017 ihn klassifizieren würde. Der EINZIGE blockierende Fall ist „beide" — 0017 bricht dann ab.

-- 1) Aggregierte Verteilung.
select
  count(*)                                                             as tourism_tenants,
  count(*) filter (where has_agency and not has_stay)                  as would_be_agency,
  count(*) filter (where has_stay and not has_agency)                  as would_be_hotel,
  count(*) filter (where not has_agency and not has_stay)              as no_events_default_agency,
  count(*) filter (where has_agency and has_stay)                      as CONFLICT_both_types
from (
  select t.id,
         coalesce(bool_or(e.campaign_type = 'agency'), false) as has_agency,
         coalesce(bool_or(e.campaign_type = 'stay'),   false) as has_stay
  from public.tenants t
  left join public.events e on e.tenant_id = t.id
  where t.sector = 'tourism'
  group by t.id
) s;

-- 2) Konflikt-Tenants EXPLIZIT auflisten (müssen vor 0017 manuell aufgelöst werden).
select t.id, t.brand_name,
       count(*) filter (where e.campaign_type='agency') as agency_events,
       count(*) filter (where e.campaign_type='stay')   as stay_events
from public.tenants t
join public.events e on e.tenant_id = t.id
where t.sector = 'tourism'
group by t.id, t.brand_name
having bool_or(e.campaign_type='agency') and bool_or(e.campaign_type='stay')
order by t.brand_name;

-- 3) Vollständige Zuordnungsvorschau je Tenant (zur Sichtprüfung vor dem Apply).
select t.id, t.brand_name,
       count(e.*)                                        as total_events,
       count(*) filter (where e.campaign_type='agency')  as agency_events,
       count(*) filter (where e.campaign_type='stay')    as stay_events,
       case
         when bool_or(e.campaign_type='agency') and bool_or(e.campaign_type='stay') then 'CONFLICT (resolve first)'
         when bool_or(e.campaign_type='agency') then 'agency'
         when bool_or(e.campaign_type='stay')   then 'hotel'
         else 'agency (no-events default)'
       end                                               as would_assign
from public.tenants t
left join public.events e on e.tenant_id = t.id
where t.sector = 'tourism'
group by t.id, t.brand_name
order by t.brand_name;
