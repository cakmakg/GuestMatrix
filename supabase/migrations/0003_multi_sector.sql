-- 0003_multi_sector.sql
-- Multi-Sektor-Support.
--   tenants:     sector (Sektor der Kundenorganisation)
--   events:      campaign_type, flow_mode, archived_at
--   submissions: comment, file_type wird optional (Feedback ohne Medien)
--
-- Voraussetzung: Basis-Migration (tenants/events/submissions + RLS) muss zuvor
-- angewendet sein (siehe docs/plan-consent-upload-reciprocity.md). Diese Migration
-- erweitert nur bestehende Tabellen. Kein Sektor ist Standard — Bestandszeilen
-- werden einmalig backfillt, danach ist die Spalte NOT NULL ohne Default.

-- ─── tenants.sector ───────────────────────────────────────────────────────────
alter table public.tenants add column if not exists sector text;
update public.tenants set sector = 'tourism' where sector is null;
alter table public.tenants alter column sector set not null;
alter table public.tenants
  add constraint tenants_sector_check
  check (sector in ('tourism', 'real_estate', 'event'));

-- ─── events.campaign_type / flow_mode / archived_at ───────────────────────────
alter table public.events add column if not exists campaign_type text;
update public.events set campaign_type = 'tour' where campaign_type is null;
alter table public.events alter column campaign_type set not null;
alter table public.events
  add constraint events_campaign_type_check
  check (campaign_type in ('tour', 'stay', 'property', 'wedding'));

alter table public.events add column if not exists flow_mode text;
update public.events set flow_mode = 'gallery' where flow_mode is null;
alter table public.events alter column flow_mode set not null;
alter table public.events
  add constraint events_flow_mode_check
  check (flow_mode in ('gallery', 'feedback'));

alter table public.events add column if not exists archived_at timestamptz;

-- Index für die Zählung aktiver Kampagnen je Tenant (aktiv = archived_at is null).
create index if not exists events_tenant_active_idx
  on public.events (tenant_id)
  where archived_at is null;

-- ─── submissions.comment / file_type optional ─────────────────────────────────
alter table public.submissions add column if not exists comment text;
-- Feedback-only-Einträge (ohne Medien) haben keinen file_type.
alter table public.submissions alter column file_type drop not null;
