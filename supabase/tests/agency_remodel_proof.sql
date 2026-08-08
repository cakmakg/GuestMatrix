-- agency_remodel_proof.sql — Nachweis des tour→agency-Remodels (Migration 0016).
--
-- Belegt (Buchstaben = Kanäle aus dem Slice-Auftrag):
--   (a) Daten-Migration: bestehende tour-Events werden zu agency — sie verschwinden NICHT.
--   (b) Fremdschlüssel: die an ein migriertes Event angehängten Submissions bleiben verbunden
--       und im Betreiber-Panel sichtbar (kein Inhalt kappt ab).
--   (c) agency behält den gallery-Flow: reziproker Gast sieht die Galerie, nicht-reziproker nicht.
--   (d) agency-Feedback-Katalog (DB-Ebene): gültige Antworten gespeichert; unbekannter Schlüssel
--       und Wert außerhalb 1–5 werden abgelehnt — im attach_feedback-Körper UND per Trigger.
--   (e) CHECK: ein agency-Event-INSERT gelingt, ein tour-Event-INSERT verstößt gegen den CHECK.
--   (f) Cross-Tenant-Isolierung (RLS) hält weiterhin.
--   (g) stay/feedback ist nicht regrediert; die Kataloge sind pro campaign_type getrennt
--       (agency-Schlüssel gelten NICHT für stay und umgekehrt).
--
-- Ausführen NACH `npx supabase db reset`. EINE Transaktion mit ROLLBACK am Ende.

begin;

-- ── Seed: Nutzer + Tenants (als DB-Owner; RLS wird für den Aufbau umgangen) ───────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','op-a@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','op-b@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','guest1@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','88888888-8888-4888-8888-888888888888','authenticated','authenticated','guest2@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','77777777-7777-4777-8777-777777777777','authenticated','authenticated','guest3@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, plan) values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Agentur A','Marke A','tourism','free'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Agentur B','Marke B','tourism','free');

-- ═══ (a)+(b) Migrations-Sequenz gegen ECHTE tour-Daten (läuft ZUERST, events-Tabelle leer) ═══
-- Nach db reset ist der 0016-CHECK bereits ('agency','stay') und der Seed leer; der Migrations-
-- Datenschritt gegen tour-Daten lässt sich so nicht mehr beobachten. Dieser Block MUSS vor dem
-- Seeden der agency-Events laufen (der CHECK ist tabellenweit — tour und agency können nicht
-- gleichzeitig unter je einem CHECK existieren). Er stellt den PRE-0016-Zustand originalgetreu nach
-- (0009-CHECK erlaubt nur ('tour','stay')) und fährt EXAKT die 0016-Sequenz drop→update→add.
-- Würde man (wie im ersten, fehlerhaften Cloud-Push) das UPDATE VOR dem DROP ausführen, lehnte der
-- alte CHECK den Übergangswert 'agency' mit 23514 ab — dieser Block fängt genau diese Regression.
do $$
declare
  v_type text; v_tour_rows int; v_sub_join int;
begin
  -- PRE-0016-Zustand: der alte 0009-CHECK erlaubt ausschließlich ('tour','stay').
  alter table public.events drop constraint events_campaign_type_check;
  alter table public.events add constraint events_campaign_type_check
    check (campaign_type in ('tour','stay'));

  -- Echte Alt-Daten: ein tour-Event + angehängte Submission (gültig unter dem alten CHECK).
  insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode)
    values ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','Alt-Tour',current_date,'tour','gallery');
  insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag)
    values ('b1b1b1b1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','image','p/x.jpg',now(),now(),false);

  -- >>> EXAKT die 0016-Sequenz: erst alten CHECK droppen, DANN Daten migrieren, DANN neuen CHECK <<<
  alter table public.events drop constraint events_campaign_type_check;
  update public.events set campaign_type = 'agency' where campaign_type = 'tour';
  alter table public.events add constraint events_campaign_type_check
    check (campaign_type in ('agency','stay'));

  select campaign_type into v_type from public.events where id='66666666-6666-4666-8666-666666666666';
  select count(*) into v_tour_rows from public.events where campaign_type='tour';
  -- FK-Nachweis: die Submission joint weiterhin auf ihr (jetzt agency-)Event.
  select count(*) into v_sub_join
    from public.submissions s join public.events e on e.id = s.event_id
    where s.id='b1b1b1b1-1111-4111-8111-111111111111' and e.campaign_type='agency';

  if v_type = 'agency' and v_tour_rows = 0 and v_sub_join = 1
    then raise notice 'PASS (a+b): tour→agency migriert (Event bleibt, 0 tour-Reste, angehängte Submission joint auf agency-Event)';
  else raise notice 'FAIL (a+b): type=%, tour_rows=%, sub_join=%', v_type, v_tour_rows, v_sub_join; end if;
exception when others then raise notice 'ERR (a+b): %', sqlerrm; end $$;

-- ── Seed: aktive Events unter dem post-0016-CHECK — agency/gallery (A + B), stay/feedback (A) ──
insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Agentur-Galerie A',current_date,'agency','gallery'),
  ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Hotel-Feedback A',current_date,'stay','feedback'),
  ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Agentur-Galerie B',current_date,'agency','gallery');

-- Medien-Beiträge: guest1 + guest2 auf dem agency-Event von A; guest2 auf dem agency-Event von B.
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag) values
  ('a1a1a1a1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999','image','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/a1a1a1a1-1111-4111-8111-111111111111/x.jpg',now(),now(),false),
  ('a2a2a2a2-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','88888888-8888-4888-8888-888888888888','image','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/a2a2a2a2-2222-4222-8222-222222222222/x.jpg',now(),now(),false),
  ('c1c1c1c1-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','88888888-8888-4888-8888-888888888888','image','22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444/c1c1c1c1-1111-4111-8111-111111111111/x.jpg',now(),now(),false);

-- TEST-VORBEDINGUNG: Grants für die API-Rollen (idempotent; regulär via 0007 + 0012/0013/0016).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;
grant execute on function public.attach_feedback(uuid, smallint, text, jsonb) to anon, authenticated;

-- ═══ (b) Panel-Sicht: Tenant A sieht die Submission des migrierten Events ══════════
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where id='b1b1b1b1-1111-4111-8111-111111111111' and event_id='66666666-6666-4666-8666-666666666666';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (b-panel): migrierte Submission bleibt im Betreiber-Panel sichtbar';
  else raise notice 'FAIL (b-panel): Tenant sieht die migrierte Submission nicht (n=%)', n; end if;
exception when others then reset role; raise notice 'ERR (b-panel): %', sqlerrm; end $$;

-- ═══ (e) CHECK-Öffnung: ein agency/gallery-Event lässt sich anlegen ════════════════
do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','AG2',current_date,'agency','gallery');
  raise notice 'PASS (e-open): agency/gallery-Event angelegt';
exception when others then raise notice 'FAIL (e-open): agency abgelehnt — %', sqlerrm; end $$;

-- ═══ (e) CHECK-Sperre: der alte tour-Wert wird abgelehnt ═══════════════════════════
do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','TOUR',current_date,'tour','gallery');
  raise notice 'FAIL (e-lock): tour campaign_type angelegt — CHECK greift nicht!';
exception when check_violation then raise notice 'PASS (e-lock): tour abgelehnt — %', sqlerrm;
  when others then raise notice 'ERR (e-lock): %', sqlerrm; end $$;

-- ═══ (c) Reciprocity: reziproker Gast (guest1) sieht die agency-Galerie ════════════
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  -- guest1 hat auf dem agency-Event hochgeladen -> has_completed_upload=true, is_gallery_event=true.
  -- Er sieht den Beitrag von guest2 (fremd) über public_gallery_select.
  select count(*) into n from public.submissions
    where event_id='33333333-3333-4333-8333-333333333333'
      and guest_user_id='88888888-8888-4888-8888-888888888888';
  reset role; perform set_config('request.jwt.claims','', true);
  if n >= 1 then raise notice 'PASS (c-recip): reziproker Gast sieht die agency-Galerie (% fremde/r Beitrag/e)', n;
  else raise notice 'FAIL (c-recip): Galerie leer trotz eigenem Upload'; end if;
exception when others then reset role; raise notice 'ERR (c-recip): %', sqlerrm; end $$;

-- ═══ (c) Reciprocity-Gate: nicht-reziproker Gast (guest3) sieht NICHTS ═════════════
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}', true);
  set local role authenticated;
  -- guest3 hat NICHT hochgeladen -> has_completed_upload=false -> keine Galerie-Zeilen.
  select count(*) into n from public.submissions
    where event_id='33333333-3333-4333-8333-333333333333';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (c-gate): nicht-reziproker Gast sieht die Galerie NICHT';
  else raise notice 'FAIL (c-gate): LECK — nicht-reziproker Gast sieht % Zeile(n)', n; end if;
exception when others then reset role; raise notice 'ERR (c-gate): %', sqlerrm; end $$;

-- ═══ (d) attach_feedback: gültige agency-Antworten werden gespeichert ══════════════
do $$ declare v uuid; a jsonb; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('a1a1a1a1-1111-4111-8111-111111111111'::uuid, 5::smallint, 'Tolle Reise',
    '{"experience":5,"organization":4,"service":5,"value":3}'::jsonb) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  select feedback_answers into a from public.submissions where id='a1a1a1a1-1111-4111-8111-111111111111';
  if v = 'a1a1a1a1-1111-4111-8111-111111111111' and a = '{"experience":5,"organization":4,"service":5,"value":3}'::jsonb
    then raise notice 'PASS (d-valid): gültige agency-Antworten gespeichert';
  else raise notice 'FAIL (d-valid): rpc=%, answers=%', v, a; end if;
exception when others then reset role; raise notice 'ERR (d-valid): %', sqlerrm; end $$;

-- ═══ (d) attach_feedback: unbekannter agency-Schlüssel wird DB-seitig abgelehnt ════
do $$ declare v uuid; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('a1a1a1a1-1111-4111-8111-111111111111'::uuid, null, null,
    '{"bogus":5}'::jsonb) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (d-badkey): unbekannter Schlüssel NICHT abgelehnt (rpc=%)', v;
exception
  when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
    raise notice 'PASS (d-badkey): unbekannter agency-Schlüssel DB-seitig abgelehnt';
  when others then reset role; raise notice 'ERR (d-badkey): %', sqlerrm; end $$;

-- ═══ (d) attach_feedback: Wert außerhalb 1–5 wird DB-seitig abgelehnt ══════════════
do $$ declare v uuid; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('a1a1a1a1-1111-4111-8111-111111111111'::uuid, null, null,
    '{"experience":9}'::jsonb) into v;
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (d-badval): Wert 9 NICHT abgelehnt (rpc=%)', v;
exception
  when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
    raise notice 'PASS (d-badval): agency-Wert außerhalb 1–5 DB-seitig abgelehnt';
  when others then reset role; raise notice 'ERR (d-badval): %', sqlerrm; end $$;

-- ═══ (d) INSERT-Trigger: medienloser Feedback-INSERT mit ungültigem agency-Schlüssel ═══
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, consent_at, uploaded_at, feedback_answers)
    values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
            auth.uid(), now(), now(), '{"bogus":3}'::jsonb);
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (d-trigger-badkey): medienloser INSERT mit ungültigem Schlüssel zugelassen';
exception
  when sqlstate '22023' then reset role; perform set_config('request.jwt.claims','', true);
    raise notice 'PASS (d-trigger-badkey): Trigger lehnt ungültige agency-Antworten beim INSERT ab';
  when others then reset role; raise notice 'ERR (d-trigger-badkey): %', sqlerrm; end $$;

-- ═══ (d) INSERT-Trigger: gültige medienlose agency-Antwort wird zugelassen ═════════
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.submissions (tenant_id, event_id, guest_user_id, consent_at, uploaded_at, feedback_answers)
    values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
            auth.uid(), now(), now(), '{"experience":5}'::jsonb);
  get diagnostics n = row_count;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (d-trigger-valid): gültige medienlose agency-Antwort zugelassen';
  else raise notice 'FAIL (d-trigger-valid): % Zeile(n) eingefügt', n; end if;
exception when others then reset role; raise notice 'ERR (d-trigger-valid): %', sqlerrm; end $$;

-- ═══ (g) Katalog-Trennung pro campaign_type (direkte Validierung) ══════════════════
do $$ begin
  -- agency akzeptiert seinen Katalog …
  perform public.validate_feedback_answers('agency','{"experience":5,"organization":4,"service":3,"value":2}'::jsonb);
  -- … stay akzeptiert seinen Katalog (Regression) …
  perform public.validate_feedback_answers('stay','{"cleanliness":5,"service":4,"location":3,"value":2}'::jsonb);
  raise notice 'PASS (g-valid): agency- und stay-Katalog werden je akzeptiert';
exception when others then raise notice 'FAIL (g-valid): gültiger Katalog abgelehnt — %', sqlerrm; end $$;

do $$ begin
  -- stay-Schlüssel 'cleanliness' ist bei agency UNGÜLTIG (getrennte Namensräume).
  perform public.validate_feedback_answers('agency','{"cleanliness":5}'::jsonb);
  raise notice 'FAIL (g-cross1): stay-Schlüssel bei agency akzeptiert';
exception when sqlstate '22023' then raise notice 'PASS (g-cross1): stay-Schlüssel bei agency abgelehnt';
  when others then raise notice 'ERR (g-cross1): %', sqlerrm; end $$;

do $$ begin
  -- agency-Schlüssel 'experience' ist bei stay UNGÜLTIG (keine stay-Regression durch 0016).
  perform public.validate_feedback_answers('stay','{"experience":5}'::jsonb);
  raise notice 'FAIL (g-cross2): agency-Schlüssel bei stay akzeptiert';
exception when sqlstate '22023' then raise notice 'PASS (g-cross2): agency-Schlüssel bei stay abgelehnt';
  when others then raise notice 'ERR (g-cross2): %', sqlerrm; end $$;

-- ═══ (f) Cross-Tenant-Isolierung: Tenant A sieht NICHT die Submission von Tenant B ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where tenant_id='22222222-2222-4222-8222-222222222222';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (f-isolation): Tenant A sieht keine fremde (Tenant-B-)Submission';
  else raise notice 'FAIL (f-isolation): LECK — Tenant A sieht % fremde Zeile(n)', n; end if;
exception when others then reset role; raise notice 'ERR (f-isolation): %', sqlerrm; end $$;

rollback;
