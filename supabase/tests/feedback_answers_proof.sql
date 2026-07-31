-- feedback_answers_proof.sql — Nachweis der Feedback-Anreicherung (Migration 0012) und des
-- tour-/rate-Bugfixes. Ergänzt stay_feedback_rls_proof.sql (Sichtbarkeit) und die App-Tests.
--
-- Belegt:
--   A) tour-/rate BUGFIX (vorher/nachher): ein direktes Gast-UPDATE von rating trifft 0 Zeilen
--      (Gäste haben KEINE UPDATE-RLS-Policy) → die Bewertung ging still verloren. attach_feedback
--      (SECURITY DEFINER) setzt sie dagegen ownership-geprüft.
--   B) DB-seitige Antwort-Validierung (Defense-in-Depth, jsonb schemalos): gültige Antworten
--      werden gespeichert; unbekannte Schlüssel und Werte außerhalb 1–5 werden abgelehnt — im
--      attach_feedback-Körper UND über den BEFORE-INSERT-Trigger (medienloser Pfad).
--   C) ENGE BERECHTIGUNG (aus 0010 erhalten): attach_feedback berührt NUR rating/comment/
--      feedback_answers — NICHT moderation_flag/media_url/tenant_id/deleted_at.
--
-- Ausführen NACH `npx supabase db reset`. EINE Transaktion mit ROLLBACK am Ende.

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','op-a@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','guest1@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, plan) values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Tenant A','Marke A','tourism','free');

insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Hotel-Feedback',current_date,'stay','feedback'),
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Tour-Galerie',current_date,'tour','gallery');

-- Medien-Beitrag von guest1 auf dem TOUR-Event (rating NULL) — für /rate vorher/nachher.
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag) values
  ('a1a1a1a1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999','image','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/a1a1a1a1-1111-4111-8111-111111111111/x.jpg',now(),now(),false);

-- Medien-Beitrag von guest1 auf dem STAY-Event (rating/comment/answers NULL) — für attach + enge Berechtigung.
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag) values
  ('c1c1c1c1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','99999999-9999-4999-8999-999999999999','image','11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/c1c1c1c1-1111-4111-8111-111111111111/x.jpg',now(),now(),false);

-- TEST-VORBEDINGUNG: Grants für die API-Rollen (idempotent; regulär via 0007 + 0012).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;
grant execute on function public.attach_feedback(uuid, smallint, text, jsonb) to anon, authenticated;

-- ═══ A) tour-/rate: VORHER — direktes Gast-UPDATE trifft 0 Zeilen (Bug) ═══════════
do $$ declare r int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  -- So arbeitete die ALTE /rate-Route: direktes update() als Gast. Ohne Gast-UPDATE-Policy = No-op.
  update public.submissions set rating = 5
    where id = 'a1a1a1a1-1111-4111-8111-111111111111' and guest_user_id = auth.uid();
  reset role; perform set_config('request.jwt.claims','', true);
  select rating into r from public.submissions where id='a1a1a1a1-1111-4111-8111-111111111111';
  if r is null then raise notice 'PASS (rate-before): direktes Gast-UPDATE bleibt wirkungslos (rating NULL) — der alte Pfad war kaputt';
  else raise notice 'FAIL (rate-before): direktes UPDATE hat rating=% gesetzt (unerwartet)', r; end if;
exception when others then reset role; raise notice 'ERR (rate-before): %', sqlerrm; end $$;

-- ═══ A) tour-/rate: NACHHER — attach_feedback setzt die Bewertung (Fix) ═══════════
do $$ declare v uuid; r int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('a1a1a1a1-1111-4111-8111-111111111111'::uuid, 5::smallint) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  select rating into r from public.submissions where id='a1a1a1a1-1111-4111-8111-111111111111';
  if v = 'a1a1a1a1-1111-4111-8111-111111111111' and r = 5
    then raise notice 'PASS (rate-after): attach_feedback setzt die Tour-Bewertung (rating=5)';
  else raise notice 'FAIL (rate-after): rpc=%, rating=%', v, r; end if;
exception when others then reset role; raise notice 'ERR (rate-after): %', sqlerrm; end $$;

-- ═══ B) attach_feedback: gültige strukturierte Antworten werden gespeichert ═══════
do $$ declare v uuid; a jsonb; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('c1c1c1c1-1111-4111-8111-111111111111'::uuid, 4::smallint, 'Sehr gut',
    '{"cleanliness":5,"service":4}'::jsonb) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  select feedback_answers into a from public.submissions where id='c1c1c1c1-1111-4111-8111-111111111111';
  if v = 'c1c1c1c1-1111-4111-8111-111111111111' and a = '{"cleanliness":5,"service":4}'::jsonb
    then raise notice 'PASS (answers-valid): gültige Antworten gespeichert';
  else raise notice 'FAIL (answers-valid): rpc=%, answers=%', v, a; end if;
exception when others then reset role; raise notice 'ERR (answers-valid): %', sqlerrm; end $$;

-- ═══ B) attach_feedback: unbekannter Schlüssel wird DB-seitig abgelehnt ═══════════
do $$ declare v uuid; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('c1c1c1c1-1111-4111-8111-111111111111'::uuid, null, null,
    '{"bogus":5}'::jsonb) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (answers-badkey): unbekannter Schlüssel wurde NICHT abgelehnt (rpc=%)', v;
exception
  when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
    raise notice 'PASS (answers-badkey): unbekannter Schlüssel DB-seitig abgelehnt';
  when others then reset role; raise notice 'ERR (answers-badkey): %', sqlerrm; end $$;

-- ═══ B) attach_feedback: Wert außerhalb 1–5 wird DB-seitig abgelehnt ══════════════
do $$ declare v uuid; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('c1c1c1c1-1111-4111-8111-111111111111'::uuid, null, null,
    '{"cleanliness":6}'::jsonb) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (answers-badval): Wert 6 wurde NICHT abgelehnt (rpc=%)', v;
exception
  when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
    raise notice 'PASS (answers-badval): Wert außerhalb 1–5 DB-seitig abgelehnt';
  when others then reset role; raise notice 'ERR (answers-badval): %', sqlerrm; end $$;

-- ═══ B) INSERT-Trigger: medienloser Feedback-INSERT mit ungültigem Schlüssel scheitert ═══
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, consent_at, uploaded_at, feedback_answers)
    values ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',
            auth.uid(), now(), now(), '{"bogus":3}'::jsonb);
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (trigger-badkey): medienloser INSERT mit ungültigem Schlüssel wurde zugelassen';
exception
  when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
    raise notice 'PASS (trigger-badkey): Trigger lehnt ungültige Antworten beim INSERT ab';
  when others then reset role; raise notice 'ERR (trigger-badkey): %', sqlerrm; end $$;

-- ═══ B) INSERT-Trigger: gültige medienlose Feedback-Antworten werden zugelassen ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, consent_at, uploaded_at, feedback_answers)
    values ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',
            auth.uid(), now(), now(), '{"cleanliness":5}'::jsonb);
  get diagnostics n = row_count;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (trigger-valid): gültige medienlose Feedback-Antworten zugelassen';
  else raise notice 'FAIL (trigger-valid): % Zeile(n) eingefügt', n; end if;
exception when others then reset role; raise notice 'ERR (trigger-valid): %', sqlerrm; end $$;

-- ═══ C) Enge Berechtigung: attach_feedback berührt NUR rating/comment/answers ═════
do $$
declare
  mf_before boolean; mu_before text; tid_before uuid; del_before timestamptz;
  mf_after boolean; mu_after text; tid_after uuid; del_after timestamptz;
  r int; c text; a jsonb; v uuid;
begin
  select moderation_flag, media_url, tenant_id, deleted_at
    into mf_before, mu_before, tid_before, del_before
    from public.submissions where id='c1c1c1c1-1111-4111-8111-111111111111';

  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('c1c1c1c1-1111-4111-8111-111111111111'::uuid, 2::smallint, 'x',
    '{"location":3}'::jsonb) into v;
  reset role; perform set_config('request.jwt.claims','', true);

  select moderation_flag, media_url, tenant_id, deleted_at, rating, comment, feedback_answers
    into mf_after, mu_after, tid_after, del_after, r, c, a
    from public.submissions where id='c1c1c1c1-1111-4111-8111-111111111111';

  if mf_after is not distinct from mf_before
     and mu_after is not distinct from mu_before
     and tid_after is not distinct from tid_before
     and del_after is not distinct from del_before
     and r = 2 and c = 'x' and a = '{"location":3}'::jsonb
    then raise notice 'PASS (least-priv): attach_feedback ändert NUR rating/comment/answers, nicht moderation_flag/media_url/tenant_id/deleted_at';
  else raise notice 'FAIL (least-priv): mf %/%  mu %/%  tid %/%  del %/%  r=% c=% a=%',
    mf_before, mf_after, mu_before, mu_after, tid_before, tid_after, del_before, del_after, r, c, a; end if;
exception when others then reset role; raise notice 'ERR (least-priv): %', sqlerrm; end $$;

rollback;
