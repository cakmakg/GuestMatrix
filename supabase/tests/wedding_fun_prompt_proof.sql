-- wedding_fun_prompt_proof.sql — Nachweis für 0019 (typ-bewusste validate_feedback_answers).
-- Ergänzt feedback_answers_proof.sql (0012/0016). Belegt die vier geforderten Garantien:
--   (1) wedding.three_words → String akzeptiert, Zahl abgelehnt (Typ-Konflikt, neu).
--   (2) stay.cleanliness → weiterhin Zahl 1–5 erzwungen, String abgelehnt (REGRESSION: altes
--       Verhalten der Scale-Kataloge stay/agency exakt erhalten). Wert außerhalb 1–5 weiter abgelehnt.
--   (3) unbekannter Schlüssel weiterhin abgelehnt (0012-Garantie); Text-Schlüssel three_words gilt
--       NUR für wedding (Kataloge pro campaign_type getrennt); Text über 60 Zeichen abgelehnt.
--   (4) BEIDE Eingabepfade (presign-Form + medienloser Gästebuch-POST-Form) laufen durch die neue
--       Typ-Prüfung — beide inserten via guest_insert_submission → BEFORE-INSERT-Trigger
--       trg_validate_feedback_answers → validate_feedback_answers.
--
-- KEINE Sichtbarkeitsänderung: das geschlossene Gästebuch (event_guestbook_rls_proof.sql, 11/11)
-- bleibt unberührt. Ausführen NACH `npx supabase db reset`. EINE Transaktion mit ROLLBACK am Ende.

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','authenticated','authenticated','op-event@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','guest1@example.com',now(),now());

-- Event-Tenant: sector='event', business_type NULL (0018 öffnet sector-CHECK; 0017 erlaubt nicht-tourism → NULL).
insert into public.tenants (id, user_id, name, brand_name, sector, business_type, plan) values
  ('e1e1e1e1-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Wedding Co','Marke Event','event',null,'free');

-- Wedding/guestbook-Event.
insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('44444444-4444-4444-8444-444444444444','e1e1e1e1-1111-4111-8111-111111111111','Hochzeit Anna & Ben',current_date,'wedding','guestbook');

-- TEST-VORBEDINGUNG: Grants für die API-Rollen (idempotent; regulär via 0007 + 0019).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;
grant execute on function public.validate_feedback_answers(text, jsonb) to anon, authenticated;

-- ═══ (1) wedding.three_words: String akzeptiert, Zahl abgelehnt (Typ-Konflikt) ═══
do $$ begin
  perform public.validate_feedback_answers('wedding', '{"three_words":"schön emotional laut"}'::jsonb);
  raise notice 'PASS (1a): wedding.three_words als String akzeptiert';
exception when others then raise notice 'FAIL (1a): String abgelehnt — %', sqlerrm; end $$;

do $$ begin
  perform public.validate_feedback_answers('wedding', '{"three_words":5}'::jsonb);
  raise notice 'FAIL (1b): Zahl für three_words NICHT abgelehnt (Typ-Konflikt nicht erkannt)';
exception when sqlstate '22023' then raise notice 'PASS (1b): Zahl für three_words abgelehnt (Typ-Konflikt)';
  when others then raise notice 'ERR (1b): %', sqlerrm; end $$;

-- ═══ (2) stay.cleanliness: Zahl 1–5 erzwungen; String abgelehnt (Regression erhalten) ═══
do $$ begin
  perform public.validate_feedback_answers('stay', '{"cleanliness":4,"service":5}'::jsonb);
  raise notice 'PASS (2a): stay Scale-Antworten (Zahl 1–5) weiterhin akzeptiert';
exception when others then raise notice 'FAIL (2a): stay Zahl abgelehnt — %', sqlerrm; end $$;

do $$ begin
  perform public.validate_feedback_answers('stay', '{"cleanliness":"sauber"}'::jsonb);
  raise notice 'FAIL (2b): String für stay.cleanliness NICHT abgelehnt (REGRESSION!)';
exception when sqlstate '22023' then raise notice 'PASS (2b): String für stay.cleanliness abgelehnt (altes Verhalten erhalten)';
  when others then raise notice 'ERR (2b): %', sqlerrm; end $$;

do $$ begin
  perform public.validate_feedback_answers('stay', '{"cleanliness":6}'::jsonb);
  raise notice 'FAIL (2c): Wert 6 für stay NICHT abgelehnt';
exception when sqlstate '22023' then raise notice 'PASS (2c): Wert außerhalb 1–5 für stay abgelehnt';
  when others then raise notice 'ERR (2c): %', sqlerrm; end $$;

do $$ begin
  perform public.validate_feedback_answers('agency', '{"experience":5,"value":3}'::jsonb);
  raise notice 'PASS (2d): agency Scale-Katalog unverändert akzeptiert';
exception when others then raise notice 'FAIL (2d): agency abgelehnt — %', sqlerrm; end $$;

-- ═══ (3) unbekannter/kreuz-Katalog-Schlüssel abgelehnt; Text-Länge erzwungen ═══
do $$ begin
  perform public.validate_feedback_answers('wedding', '{"bogus":"x"}'::jsonb);
  raise notice 'FAIL (3a): unbekannter Schlüssel NICHT abgelehnt';
exception when sqlstate '22023' then raise notice 'PASS (3a): unbekannter Schlüssel abgelehnt (0012-Garantie)';
  when others then raise notice 'ERR (3a): %', sqlerrm; end $$;

do $$ begin
  perform public.validate_feedback_answers('stay', '{"three_words":"x"}'::jsonb);
  raise notice 'FAIL (3b): three_words auf stay NICHT abgelehnt (Kataloge nicht getrennt)';
exception when sqlstate '22023' then raise notice 'PASS (3b): Text-Schlüssel three_words auf stay abgelehnt (pro-Katalog getrennt)';
  when others then raise notice 'ERR (3b): %', sqlerrm; end $$;

do $$ begin
  perform public.validate_feedback_answers('wedding', jsonb_build_object('three_words', repeat('x', 61)));
  raise notice 'FAIL (3c): 61-Zeichen-Text NICHT abgelehnt (Längenlimit fehlt)';
exception when sqlstate '22023' then raise notice 'PASS (3c): Text über 60 Zeichen abgelehnt';
  when others then raise notice 'ERR (3c): %', sqlerrm; end $$;

-- ═══ (4) Beide Eingabepfade durchlaufen die Typ-Prüfung (BEFORE-INSERT-Trigger) ═══
-- (4a) medienloser Gästebuch-POST-Form (kein file_type/media_url, uploaded_at gesetzt): Text → akzeptiert.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, guest_name, comment, consent_at, uploaded_at, feedback_answers)
    values ('e1e1e1e1-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
            auth.uid(),'Anna','Glückwunsch!',now(),now(),'{"three_words":"schön laut emotional"}'::jsonb);
  get diagnostics n = row_count;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (4a): medienloser Gästebuch-INSERT mit Text-Antwort akzeptiert';
  else raise notice 'FAIL (4a): row_count=%', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (4a): abgelehnt — %', sqlerrm; end $$;

-- (4b) medienloser Gästebuch-POST-Form: three_words als Zahl → vom Trigger abgelehnt.
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, guest_name, comment, consent_at, uploaded_at, feedback_answers)
    values ('e1e1e1e1-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
            auth.uid(),'Ben','Gruß',now(),now(),'{"three_words":5}'::jsonb);
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (4b): medienloser INSERT mit Zahl-Text NICHT abgelehnt';
exception when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'PASS (4b): Trigger lehnt medienlosen INSERT (Gästebuch-Pfad) mit Typ-Konflikt ab';
  when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'ERR (4b): %', sqlerrm; end $$;

-- (4c) presign-Form (file_type gesetzt, uploaded_at noch NULL): three_words als Zahl → abgelehnt.
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, file_type, guest_name, comment, consent_at, feedback_answers)
    values ('e1e1e1e1-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
            auth.uid(),'image','Cara','Foto-Gruß',now(),'{"three_words":9}'::jsonb);
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (4c): presign-INSERT mit Zahl-Text NICHT abgelehnt';
exception when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'PASS (4c): Trigger lehnt presign-INSERT mit Typ-Konflikt ab';
  when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'ERR (4c): %', sqlerrm; end $$;

-- (4d) presign-Form: three_words als String → akzeptiert.
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, file_type, guest_name, comment, consent_at, feedback_answers)
    values ('e1e1e1e1-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
            auth.uid(),'image','Dana','Foto',now(),'{"three_words":"bunt fröhlich unvergesslich"}'::jsonb);
  get diagnostics n = row_count;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (4d): presign-INSERT mit Text-Antwort akzeptiert';
  else raise notice 'FAIL (4d): row_count=%', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (4d): abgelehnt — %', sqlerrm; end $$;

rollback;
