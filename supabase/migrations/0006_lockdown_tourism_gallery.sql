-- 0006_lockdown_tourism_gallery.sql
-- Retrenchment: MVP-Validierungsziel = tourism / tour / gallery (einzige aktive Bahn).
--
-- Die Spalten tenants.sector, events.campaign_type und events.flow_mode BLEIBEN erhalten
-- (ebenso submissions.comment / guest_name / rating). Nur die erlaubten Werte werden auf je
-- einen Wert verengt, damit die DB keine feedback-/guestbook-/Nicht-Tourism-Zeile speichern
-- kann. Damit ist der in docs/ beschriebene private-comment-Leak physisch unmöglich.
--
-- Wichtig: RLS ist NICHT flow-mode-aware (public_gallery_select / public_select_events filtern
-- nicht nach flow_mode). Deshalb ist dieser CHECK — nicht eine RLS-Policy — die Garantie, dass
-- deaktivierte Modi keine Zeile halten können.
--
-- Wiedererweiterung (neuer Sektor / Modus) = ein ALTER-CONSTRAINT je Wert; die vollständige
-- Anleitung steht in docs/extension-points.md.
--
-- Voraussetzung: 0001–0005 sind angewendet. Idempotent (constraint drop + recreate).
-- Achtung Cloud: schlägt fehl, falls bereits Zeilen außerhalb tourism/tour/gallery existieren —
-- vor dem Anwenden prüfen/bereinigen. Lokal ist seed.sql leer, db reset ist sauber.

-- ─── tenants.sector → nur 'tourism' ───────────────────────────────────────────
alter table public.tenants drop constraint if exists tenants_sector_check;
alter table public.tenants
  add constraint tenants_sector_check
  check (sector = 'tourism');

-- ─── events.campaign_type → nur 'tour' ────────────────────────────────────────
alter table public.events drop constraint if exists events_campaign_type_check;
alter table public.events
  add constraint events_campaign_type_check
  check (campaign_type = 'tour');

-- ─── events.flow_mode → nur 'gallery' ─────────────────────────────────────────
alter table public.events drop constraint if exists events_flow_mode_check;
alter table public.events
  add constraint events_flow_mode_check
  check (flow_mode = 'gallery');

-- tenants_plan_check (free/pro) bleibt unverändert: Pricing ist sektor-unabhängig aktiv.
