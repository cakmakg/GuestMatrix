-- 0010_attach_feedback.sql
-- Fix: Feedback MIT Medium verlor rating/comment. Ursache: Gäste haben keine UPDATE-RLS-Policy
-- auf submissions (nur tenant_update_submissions), also traf das nachträgliche Anhängen von
-- rating/comment an den eigenen Medien-Beitrag still 0 Zeilen — kein Fehler, die Werte gingen
-- verloren. SECURITY-DEFINER-RPC (Muster wie soft_delete_submission): ownership-geprüft
-- (guest_user_id = auth.uid()), aktualisiert NUR rating/comment — kein service_role in der App,
-- keine breite Gast-UPDATE-Policy (die auch moderation_flag/media_url öffnen würde).
-- Voraussetzung: 0001..0009.

create or replace function public.attach_feedback(
  p_submission_id uuid,
  p_rating smallint default null,
  p_comment text default null
)
  returns uuid
  language sql
  volatile
  security definer
  set search_path = ''
as $$
  update public.submissions s
     set rating = p_rating,
         comment = p_comment
   where s.id = p_submission_id
     and s.deleted_at is null
     and s.guest_user_id = auth.uid()
  returning s.id;
$$;

-- Funktionen sind per Default fuer PUBLIC ausfuehrbar; explizit auf die API-Rollen einschraenken.
revoke all on function public.attach_feedback(uuid, smallint, text) from public;
grant execute on function public.attach_feedback(uuid, smallint, text) to anon, authenticated, service_role;
