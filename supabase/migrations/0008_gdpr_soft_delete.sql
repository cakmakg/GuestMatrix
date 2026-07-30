-- 0008_gdpr_soft_delete.sql
-- GDPR-Loeschung: sahiplik-kontrollü Soft-Delete auf DB-Ebene (statt in der App-Schicht).
--
-- Zwei SECURITY DEFINER-Funktionen mit demselben Ownership-Praedikat
--   (guest_user_id = auth.uid()  OR  tenant_id = current_tenant_id()):
--   1. owned_submission_media(): liest media_url ownership-geprueft, OHNE Mutation.
--      Noetig, weil public_gallery_select die SELECT-Sichtbarkeit verbreitert — die zu
--      loeschende Datei muss aus einer ownership-scoped Quelle kommen, sonst koennte ein Gast
--      die Datei eines anderen anvisieren.
--   2. soft_delete_submission(): setzt deleted_at ownership-geprueft, gibt die id zurueck.
--
-- Fail-safe-Reihenfolge liegt in der App (lib/submissions/delete-submission.ts): erst
-- Storage-remove pruefen, dann committen — deshalb sind Lesen und Commit getrennt, damit
-- deleted_at NIE gesetzt wird, bevor die Datei nachweislich weg ist.
--
-- SECURITY DEFINER + auth.uid(): der Definer-Kontext aendert die Rolle, nicht die JWT-GUCs;
-- auth.uid()/current_tenant_id() liefern weiterhin den Aufrufer (gleiches Muster wie 0001/0002).
-- Voraussetzung: 0001..0007.

create or replace function public.owned_submission_media(p_submission_id uuid)
  returns table (media_url text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select s.media_url
  from public.submissions s
  where s.id = p_submission_id
    and s.deleted_at is null
    and (s.guest_user_id = auth.uid() or s.tenant_id = public.current_tenant_id());
$$;

create or replace function public.soft_delete_submission(p_submission_id uuid)
  returns uuid
  language sql
  volatile
  security definer
  set search_path = ''
as $$
  update public.submissions s
     set deleted_at = now()
   where s.id = p_submission_id
     and s.deleted_at is null
     and (s.guest_user_id = auth.uid() or s.tenant_id = public.current_tenant_id())
  returning s.id;
$$;

-- Funktionen sind per Default fuer PUBLIC ausfuehrbar; das explizit einschraenken.
revoke all on function public.owned_submission_media(uuid) from public;
revoke all on function public.soft_delete_submission(uuid) from public;
grant execute on function public.owned_submission_media(uuid) to anon, authenticated, service_role;
grant execute on function public.soft_delete_submission(uuid) to anon, authenticated, service_role;
