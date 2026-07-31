-- 0013_grant_validate_feedback_answers.sql
-- validate_feedback_answers explizit an die API-Rollen granten — die Migration wird damit
-- selbst-tragend (statt sich auf die Supabase-Default-Privileges zu verlassen; gleiches
-- explizites Muster wie owned_submission_media/soft_delete_submission/attach_feedback).
--
-- Warum nötig: Der medienlose Feedback-INSERT läuft über den BEFORE-INSERT-Trigger
-- (trg_validate_feedback_answers, INVOKER-Rechte) und ruft validate_feedback_answers als
-- aufrufende Rolle auf — für Gäste `authenticated`. Ohne expliziten Grant hinge das an den
-- Default-Privileges der jeweiligen Umgebung. attach_feedback ist SECURITY DEFINER (läuft als
-- Owner) und braucht den Grant nicht, wird davon aber nicht negativ berührt.
-- trg_validate_feedback_answers ist eine Trigger-Funktion und wird nie direkt aufgerufen →
-- kein Grant nötig.
-- Voraussetzung: 0001..0012.

revoke all on function public.validate_feedback_answers(text, jsonb) from public;
grant execute on function public.validate_feedback_answers(text, jsonb) to anon, authenticated, service_role;
