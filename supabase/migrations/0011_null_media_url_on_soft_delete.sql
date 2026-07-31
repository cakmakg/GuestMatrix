-- 0011_null_media_url_on_soft_delete.sql
-- DSGVO-Sauberkeit: soft_delete_submission nullt beim Löschen zusätzlich media_url.
--
-- Warum: Der Fail-safe-Ablauf (lib/submissions/delete-submission.ts) entfernt ZUERST die Datei
-- aus dem Storage und committet ERST dann deleted_at. Danach zeigte media_url weiterhin auf einen
-- bereits gelöschten Storage-Pfad — ein toter Zeiger in der Zeile. Kein Lesepfad gibt gelöschte
-- Zeilen aus (alle filtern deleted_at IS NULL, u. a. owned_submission_media/public_gallery_select),
-- daher ist das Nullen funktional risikofrei und hält die Zeile sauber (Gästemedien = pers. Daten).
--
-- Reihenfolge-Sicherheit: media_url wird in Schritt 1 (owned_submission_media) VOR dem Storage-
-- Remove gelesen; das Nullen hier in Schritt 3 ändert daran nichts. Das Ownership-Prädikat bleibt
-- unverändert. media_url ist seit 0001 nullable (Feedback-Beiträge haben es ohnehin NULL).
-- `create or replace` erhält die bestehenden EXECUTE-Grants aus 0008.
-- Voraussetzung: 0001..0010.

create or replace function public.soft_delete_submission(p_submission_id uuid)
  returns uuid
  language sql
  volatile
  security definer
  set search_path = ''
as $$
  update public.submissions s
     set deleted_at = now(),
         media_url = null
   where s.id = p_submission_id
     and s.deleted_at is null
     and (s.guest_user_id = auth.uid() or s.tenant_id = public.current_tenant_id())
  returning s.id;
$$;
