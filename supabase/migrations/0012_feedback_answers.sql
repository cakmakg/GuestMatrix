-- 0012_feedback_answers.sql
-- Feedback-Anreicherung: strukturierte Zusatzfragen (v1: Sterne 1–5) je Antwort-Schlüssel,
-- gespeichert generisch als jsonb `{ fragenId: 1..5 }` in submissions.feedback_answers.
--
-- DEFENSE-IN-DEPTH: jsonb ist schemalos. Die App validiert (Zod + unknownAnswerKeys) für die UX,
-- aber die DB ist die letzte Verteidigungslinie und darf NICHT allein der App vertrauen. Deshalb:
--   * strukturelle CHECK-Constraint (Objekt-oder-null; ein Subquery ist in CHECK nicht erlaubt),
--   * semantische Validierung in validate_feedback_answers() (Schlüssel ∈ Kampagnen-Katalog,
--     Werte ganze Zahlen 1–5) — aufgerufen IM Körper von attach_feedback (Attach-Pfad) UND von
--     einem BEFORE-INSERT-Trigger (medienloser Feedback-Pfad läuft über guest_insert_submission,
--     nicht über die RPC).
--
-- Der erlaubte Schlüssel-Satz spiegelt den Code-Katalog in lib/sectors/ — gleiches Muster wie die
-- campaign_type/flow_mode-CHECKs: der Code ist die Quelle der Wahrheit, die DB erzwingt dieselbe
-- Menge unabhängig. Ein neuer Sektor-Katalog ergänzt hier die case-Verzweigung (wie ein CHECK-Wert).
-- Voraussetzung: 0001..0011.

-- ── 1) Spalte + strukturelle CHECK ────────────────────────────────────────────
alter table public.submissions
  add column if not exists feedback_answers jsonb;

alter table public.submissions
  drop constraint if exists submissions_feedback_answers_object_chk;
alter table public.submissions
  add constraint submissions_feedback_answers_object_chk
  check (feedback_answers is null or jsonb_typeof(feedback_answers) = 'object');

-- ── 2) Semantische Validierung (Schlüssel + Wertebereich) ─────────────────────
create or replace function public.validate_feedback_answers(p_campaign_type text, p_answers jsonb)
  returns void
  language plpgsql
  immutable
  set search_path = ''
as $$
declare
  v_allowed text[];
  v_key text;
  v_val jsonb;
  v_num numeric;
begin
  if p_answers is null then
    return;
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'feedback_answers must be a JSON object' using errcode = '22023';
  end if;

  -- Erlaubte Schlüssel je Kampagnentyp (spiegelt lib/sectors/). tour u. a. haben keinen Katalog
  -- → jede Antwort ist ungültig (auf tour gehören keine strukturierten Antworten).
  v_allowed := case p_campaign_type
    when 'stay' then array['cleanliness', 'service', 'location', 'value']
    else array[]::text[]
  end;

  for v_key, v_val in select key, value from jsonb_each(p_answers) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'feedback_answers: unknown key "%" for campaign_type "%"', v_key, p_campaign_type
        using errcode = '22023';
    end if;
    if jsonb_typeof(v_val) <> 'number' then
      raise exception 'feedback_answers: value for "%" must be an integer 1-5', v_key
        using errcode = '22023';
    end if;
    v_num := (v_val::text)::numeric;
    if v_num < 1 or v_num > 5 or v_num <> floor(v_num) then
      raise exception 'feedback_answers: value for "%" must be an integer 1-5', v_key
        using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- ── 3) attach_feedback um p_answers erweitern (+ Validierung im Körper) ────────
-- create or replace kann die Signatur nicht ändern → alte 3-arg-Version droppen, 4-arg neu.
-- WICHTIG (enge Berechtigung aus 0010 bleibt): das UPDATE setzt WEITERHIN NUR rating/comment/
-- feedback_answers — NICHT moderation_flag/media_url/tenant_id/deleted_at.
drop function if exists public.attach_feedback(uuid, smallint, text);

create function public.attach_feedback(
  p_submission_id uuid,
  p_rating smallint default null,
  p_comment text default null,
  p_answers jsonb default null
)
  returns uuid
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_campaign_type text;
  v_updated uuid;
begin
  -- Ownership-geprüft den campaign_type der Submission holen (guest_user_id = auth.uid()).
  select e.campaign_type into v_campaign_type
  from public.submissions s
  join public.events e on e.id = s.event_id
  where s.id = p_submission_id
    and s.deleted_at is null
    and s.guest_user_id = auth.uid();

  -- Kein Treffer = fremde/fehlende/gelöschte Submission → wie bisher No-op (RPC gibt null).
  if v_campaign_type is null then
    return null;
  end if;

  -- DB-seitige Validierung im Funktionskörper (Defense-in-Depth; jsonb ist schemalos).
  perform public.validate_feedback_answers(v_campaign_type, p_answers);

  update public.submissions s
     set rating = p_rating,
         comment = p_comment,
         feedback_answers = p_answers
   where s.id = p_submission_id
     and s.deleted_at is null
     and s.guest_user_id = auth.uid()
  returning s.id into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.attach_feedback(uuid, smallint, text, jsonb) from public;
grant execute on function public.attach_feedback(uuid, smallint, text, jsonb) to anon, authenticated, service_role;

-- ── 4) Trigger für den medienlosen Feedback-INSERT ────────────────────────────
-- Dieser Pfad (Feedback ohne Medium) läuft über guest_insert_submission, nicht über attach_feedback.
-- Der Trigger macht die DB auch hier zur letzten Verteidigungslinie (INSERT ODER UPDATE, wenn
-- feedback_answers gesetzt ist — deckt auch spätere direkte Schreibpfade ab).
create or replace function public.trg_validate_feedback_answers()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_campaign_type text;
begin
  if new.feedback_answers is null then
    return new;
  end if;
  select e.campaign_type into v_campaign_type
  from public.events e
  where e.id = new.event_id;
  perform public.validate_feedback_answers(v_campaign_type, new.feedback_answers);
  return new;
end;
$$;

drop trigger if exists submissions_validate_feedback_answers on public.submissions;
create trigger submissions_validate_feedback_answers
  before insert or update of feedback_answers on public.submissions
  for each row
  when (new.feedback_answers is not null)
  execute function public.trg_validate_feedback_answers();
