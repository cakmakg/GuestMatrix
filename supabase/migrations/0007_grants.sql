-- 0007_grants.sql
-- Tabellen-/Schema-GRANTs für die Supabase-API-Rollen (anon, authenticated, service_role).
--
-- Warum nötig: 0001..0006 aktivieren RLS und definieren Policies, erteilen den API-Rollen
-- aber KEINE Tabellenrechte. Ohne GRANT scheitert der PostgREST-Pfad mit 42501
-- ("permission denied for table ..."), noch bevor RLS greift — die App wäre nicht nutzbar.
--
-- Sicherheit: GRANT öffnet nur die Tür zur Tabelle; die Zeilen-Sichtbarkeit regelt weiterhin
-- RLS (public_select_events, tenant_*_*, public_gallery_select, guest_*). `service_role`
-- besitzt zusätzlich BYPASSRLS (Admin-Client) — das umgeht Policies, nicht die fehlenden GRANTs,
-- weshalb auch service_role hier explizit berechtigt wird.
--
-- Voraussetzung: 0001..0006. Idempotent (GRANT/ALTER DEFAULT PRIVILEGES sind wiederholbar).

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated, service_role;

-- UUID-PKs brauchen keine Sequenzen; der Vollständigkeit halber (falls später serial-Spalten):
grant usage, select
  on all sequences in schema public
  to anon, authenticated, service_role;

-- Künftige Tabellen (spätere Migrationen, als DB-Owner erstellt) automatisch berechtigen:
alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;
