-- 0004_event_guestbook.sql
-- Neuer Flow-Modus 'guestbook' für den Event-Sektor (Hochzeit).
--   submissions: guest_name (Name des Gastes beim Gästebuch-Gruß)
--   events.flow_mode: CHECK um 'guestbook' erweitert
--
-- Voraussetzung: Basis-Migration (tenants/events/submissions + RLS) sowie 0003
-- müssen zuvor angewendet sein. Diese Migration erweitert nur bestehende Tabellen
-- und ist idempotent (add column if not exists; CHECK drop + recreate).

-- ─── submissions.guest_name ───────────────────────────────────────────────────
-- Optional auf DB-Ebene (Galerie/Feedback ohne Namen); im guestbook-Modus erzwingt
-- die App-Validierung (Zod) einen Namen.
alter table public.submissions add column if not exists guest_name text;

-- ─── events.flow_mode CHECK erweitern ─────────────────────────────────────────
alter table public.events drop constraint if exists events_flow_mode_check;
alter table public.events
  add constraint events_flow_mode_check
  check (flow_mode in ('gallery', 'feedback', 'guestbook'));
