-- 0019_wedding_fun_prompt.sql
-- Wedding-Enrichment (Dilim A): eine optionale FREITEXT-Zusatzfrage im Gästebuch
-- (`event / wedding`, Schlüssel `three_words`). Die Antwort landet generisch in
-- submissions.feedback_answers.three_words — KEINE neue Spalte, KEIN Sonderfall-Code.
--
-- Kern: validate_feedback_answers wird TYP-BEWUSST. Bisher war JEDER Wert eine ganze Zahl 1–5
-- (v1: nur Sterne). Ab hier gibt es je campaign_type ZWEI Allowlists:
--   * Scale-Schlüssel  → Wert = ganze Zahl 1–5   (unverändertes Verhalten für stay/agency)
--   * Text-Schlüssel   → Wert = String, max. 60 Zeichen (neu: wedding.three_words)
-- Ein unbekannter Schlüssel bleibt abgelehnt (0012-Garantie). Ein Scale-Schlüssel mit String bzw.
-- ein Text-Schlüssel mit Zahl wird als Typ-Konflikt abgelehnt.
--
-- DEFENSE-IN-DEPTH bleibt: die App (Zod + unknownAnswerKeys + invalidAnswerTypes) prüft für die UX,
-- die DB ist die LETZTE Verteidigungslinie. Aufrufer unverändert: attach_feedback-Körper (Attach-Pfad)
-- UND der BEFORE-INSERT-Trigger trg_validate_feedback_answers (medienloser + presign-INSERT).
--
-- Der erlaubte Schlüssel-Satz spiegelt den Code-Katalog in lib/sectors/ (FeedbackQuestion.type). Ein
-- neuer Katalog ergänzt hier eine case-Verzweigung — gleiches Muster wie 0012/0016.
--
-- KEINE Sichtbarkeitsänderung: dies berührt weder events (CHECKs, flow_mode) noch die submissions-
-- RLS. Das mit event_guestbook_rls_proof.sql (11/11) bewiesene GESCHLOSSENE Gästebuch bleibt exakt.
-- events.visibility (private/shared/moderated) ist Dilim B/C/D, ein separater PR.
--
-- Voraussetzung: 0001..0018. Idempotent (create or replace der Funktion; kein DDL an Tabellen).

create or replace function public.validate_feedback_answers(p_campaign_type text, p_answers jsonb)
  returns void
  language plpgsql
  immutable
  set search_path = ''
as $$
declare
  v_scale_keys text[];
  v_text_keys  text[];
  v_text_maxlen constant int := 60;  -- spiegelt FeedbackQuestion.maxLength (wedding.three_words)
  v_key text;
  v_val jsonb;
  v_num numeric;
  v_str text;
begin
  if p_answers is null then
    return;
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'feedback_answers must be a JSON object' using errcode = '22023';
  end if;

  -- Scale-Schlüssel (Wert = ganze Zahl 1–5) je Kampagnentyp. UNVERÄNDERT ggü. 0016 — stay/agency
  -- behalten exakt ihr bisheriges Verhalten. 'service'/'value' bei agency sind eigenständig von den
  -- gleichnamigen stay-Schlüsseln (jede case-Verzweigung ist ihr eigener Raum).
  v_scale_keys := case p_campaign_type
    when 'stay' then array['cleanliness', 'service', 'location', 'value']
    when 'agency' then array['experience', 'organization', 'service', 'value']
    else array[]::text[]
  end;

  -- Text-Schlüssel (Wert = String, max. v_text_maxlen Zeichen). NEU: wedding.
  v_text_keys := case p_campaign_type
    when 'wedding' then array['three_words']
    else array[]::text[]
  end;

  for v_key, v_val in select key, value from jsonb_each(p_answers) loop
    if v_key = any (v_scale_keys) then
      -- Scale: ganze Zahl 1–5 (identisch zum bisherigen Verhalten).
      if jsonb_typeof(v_val) <> 'number' then
        raise exception 'feedback_answers: value for "%" must be an integer 1-5', v_key
          using errcode = '22023';
      end if;
      v_num := (v_val::text)::numeric;
      if v_num < 1 or v_num > 5 or v_num <> floor(v_num) then
        raise exception 'feedback_answers: value for "%" must be an integer 1-5', v_key
          using errcode = '22023';
      end if;
    elsif v_key = any (v_text_keys) then
      -- Text: String mit Längenbegrenzung.
      if jsonb_typeof(v_val) <> 'string' then
        raise exception 'feedback_answers: value for "%" must be a string', v_key
          using errcode = '22023';
      end if;
      v_str := v_val #>> '{}';  -- jsonb-String ohne Anführungszeichen als text
      if char_length(v_str) > v_text_maxlen then
        raise exception 'feedback_answers: value for "%" exceeds % characters', v_key, v_text_maxlen
          using errcode = '22023';
      end if;
    else
      -- Weder Scale- noch Text-Schlüssel dieses Kampagnentyps → unbekannt (0012-Garantie).
      raise exception 'feedback_answers: unknown key "%" for campaign_type "%"', v_key, p_campaign_type
        using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- Grant bleibt über create-or-replace erhalten; zur Selbst-Genügsamkeit (wie 0013/0016) erneut setzen.
revoke all on function public.validate_feedback_answers(text, jsonb) from public;
grant execute on function public.validate_feedback_answers(text, jsonb) to anon, authenticated, service_role;
