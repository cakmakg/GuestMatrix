-- 0020_submission_resolution.sql
-- Service Recovery: ein Gästebeitrag kann als BEARBEITET markiert werden (`resolved_at`).
--
-- Problem: Die Übersicht zählte „offene Punkte" bisher als (Bewertung <= 2 ODER gesperrt) —
-- ein reiner Vekil. Eine längst bearbeitete Beschwerde blieb für immer in der Zahl, weil es
-- keinen Zustand gab, der „erledigt" ausdrücken konnte. Die Kennzahl zeigte damit die
-- Historie, nicht die tatsächliche Arbeitslast.
--
-- Modellierung als ZEITSTEMPEL (nicht als Status-Enum), passend zu den bestehenden Spalten
-- deleted_at / archived_at / consent_at / uploaded_at: NULL = offen, gesetzt = erledigt. Das
-- hält den Zeitpunkt fest (wann wurde reagiert) statt nur ein Flag, und braucht keinen CHECK.
--
-- KEINE neue RLS-Policy — bewusst, und hier begründet, damit die Auslassung nicht wie ein
-- Versehen aussieht:
--   * Schreiben: tenant_update_submissions (0001, Zeile 116) deckt UPDATE bereits mit
--     `using (tenant_id = current_tenant_id())` ab. Da für UPDATE KEIN WITH CHECK angegeben
--     ist, verwendet Postgres die USING-Bedingung auch als WITH CHECK — die neue Spalte ist
--     also exakt für die eigenen Zeilen des Tenants schreibbar, für fremde nicht.
--   * Gäste: auf submissions existiert nur EINE UPDATE-Policy (die obige, tenant-gebunden).
--     Gäste haben insert/select/delete, kein UPDATE; die einzige Gast-Schreibbahn ist die
--     SECURITY-DEFINER-RPC attach_feedback (0010), die ausschließlich rating/comment setzt.
--     Ein Gast kann seinen eigenen Beitrag daher NICHT als erledigt markieren.
--   * Lesen: resolved_at ist ein interner Betreiber-Vermerk. Die Gäste-Sichten
--     (public_gallery_select, 0009/0018) selektieren spaltenunabhängig ganze Zeilen; die
--     Spalte trägt keine personenbezogenen Daten und ändert die Sichtbarkeitsgrenze nicht.
--
-- Voraussetzung: 0001..0019. Idempotent (add column if not exists; create index if not exists).

alter table public.submissions add column if not exists resolved_at timestamptz;

comment on column public.submissions.resolved_at is
  'Service Recovery: Zeitpunkt, zu dem der Betreiber den Beitrag als bearbeitet markiert hat. NULL = offen. Nur über tenant_update_submissions beschreibbar (kein Gast-Pfad).';

-- Die Übersicht und die Antwortliste fragen genau nach den OFFENEN Punkten eines Tenants.
-- Partieller Index: er deckt die gestellte Frage ab und wächst nicht mit den erledigten Zeilen.
create index if not exists submissions_open_resolution_idx
  on public.submissions (tenant_id)
  where resolved_at is null;
