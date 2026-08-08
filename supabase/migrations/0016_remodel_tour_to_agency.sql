-- 0016_remodel_tour_to_agency.sql
-- Remodel: der Kampagnentyp `tour` wird zu `agency`. Go-to-Market-Repositionierung des
-- Beachheads von Reiseleiter:innen ("Tour") auf Reiseagenturen ("Agency") — INNERHALB des
-- tourism-Sektors. Der Sektor bleibt 'tourism' (tenants_sector_check UNVERÄNDERT); nur der
-- Kampagnentyp-Wert wandert. `agency` behält den gallery-Flow (Foto/Video + Reciprocity +
-- Galerie) und erhält zusätzlich einen strukturierten Feedback-Katalog (Reiseerlebnis +
-- Agentur-Service) — KEIN neuer flow_mode, nur die vorhandene gallery+feedback_answers-Mechanik.
--
-- Diese Migration EDITIERT keine früheren Migrationen. Sie wendet nur auf den aktuellen Zustand an
-- und ist ATOMAR (der Supabase-Migration-Runner umschließt die Datei in einer Transaktion):
--   (1) Den ALTEN CHECK droppen — sonst lehnt er (in ('tour','stay'), aus 0009) den Übergangswert
--       'agency' schon beim UPDATE ab. Genau das schlug beim ersten Cloud-Push mit echten
--       tour-Daten fehl (23514); lokal fiel es nicht auf, weil der leere Seed 0 Zeilen hatte.
--   (2) Die Daten migrieren: UPDATE events SET campaign_type='agency' WHERE ='tour' (jetzt frei).
--   (3) Den NEUEN CHECK setzen: check (campaign_type in ('agency','stay')) — validiert alle Zeilen.
-- Reihenfolge zwingend drop→update→add: der Übergangswert muss zwischen altem und neuem CHECK
-- schreibbar sein. Schlägt ein Schritt fehl, rollt die Transaktion alles zurück (kein Halbzustand).
--
-- Fremdschlüssel: submissions.event_id → events.id bleibt unberührt. Ein UPDATE der Spalte
-- campaign_type ändert die Zeilenidentität nicht; angehängte Submissions bleiben mit ihrem Event
-- (jetzt 'agency') verbunden — kein Inhalt geht verloren. Nachweis: agency_remodel_proof.sql (b).
--
-- Voraussetzung: 0001..0015 sind angewendet. Idempotent (constraint drop + recreate; das UPDATE
-- ist nach dem ersten Lauf ein No-op, weil keine 'tour'-Zeile mehr existiert).

-- ── 1) Alten CHECK droppen (macht den Übergangswert 'agency' beim UPDATE schreibbar) ──
-- Der 0009-CHECK erlaubt nur ('tour','stay'); ohne diesen Drop scheitert Schritt 2 an echten
-- tour-Zeilen. Zwischen Drop und Re-Add ist campaign_type kurz unbeschränkt — nur innerhalb
-- dieser Transaktion, also unkritisch.
alter table public.events drop constraint if exists events_campaign_type_check;

-- ── 2) Daten migrieren: bestehende tour-Events werden zu agency ────────────────
update public.events set campaign_type = 'agency' where campaign_type = 'tour';

-- ── 3) Neuen CHECK setzen: campaign_type in ('agency', 'stay') ─────────────────
-- tenants_sector_check ('tourism') und events_flow_mode_check ('gallery','feedback') bleiben
-- UNVERÄNDERT — dieser Slice öffnet keinen Sektor und keinen neuen Flow-Modus.
alter table public.events add constraint events_campaign_type_check
  check (campaign_type in ('agency', 'stay'));

-- ── 3) Feedback-Katalog: agency-Schlüssel in die DB-Validierung aufnehmen ───────
-- Defense-in-Depth (jsonb ist schemalos): validate_feedback_answers erzwingt Schlüssel ∈ Katalog
-- + Werte 1–5, unabhängig von der App. Der erlaubte Schlüssel-Satz spiegelt lib/sectors/ (gleiches
-- Muster wie die CHECKs). Die Allowlist ist PRO campaign_type — 'service'/'value' bei agency sind
-- eigenständig von den gleichnamigen stay-Schlüsseln (jede case-Verzweigung ist ihr eigener Raum).
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

  -- Erlaubte Schlüssel je Kampagnentyp (spiegelt lib/sectors/). Kampagnentypen ohne Katalog
  -- → jede Antwort ist ungültig (dort gehören keine strukturierten Antworten hin).
  v_allowed := case p_campaign_type
    when 'stay' then array['cleanliness', 'service', 'location', 'value']
    when 'agency' then array['experience', 'organization', 'service', 'value']
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

-- Grant bleibt über create-or-replace erhalten; zur Selbst-Genügsamkeit (wie 0013) erneut setzen.
revoke all on function public.validate_feedback_answers(text, jsonb) from public;
grant execute on function public.validate_feedback_answers(text, jsonb) to anon, authenticated, service_role;
