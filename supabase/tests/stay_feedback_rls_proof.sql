-- stay_feedback_rls_proof.sql — T2/B1-Nachweis: Feedback-Kommentare dürfen NIE über die
-- Gäste-Galerie an andere Gäste gelangen. ZWEI-GÄSTE-Szenario (keine leere Galerie):
-- guest1 und guest2 geben beide Feedback auf demselben stay/feedback-Event ab; guest2 darf
-- den privaten comment von guest1 NICHT sehen — obwohl guest2 selbst beigetragen hat
-- (has_completed_upload wäre sonst true → ohne is_gallery_event ein Leck).
-- Zusätzlich: Gallery-Regression, Panel-Sicht, CHECK-Öffnung/Sperre.
--
-- Ausführen NACH `npx supabase db reset`. EINE Transaktion mit ROLLBACK am Ende.

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','op-a@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','guest1@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','88888888-8888-4888-8888-888888888888','authenticated','authenticated','guest2@example.com',now(),now());

insert into public.tenants (id, user_id, name, brand_name, sector, plan) values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Tenant A','Marke A','tourism','free');

-- Ein stay/feedback-Event (Hotel) und ein agency/gallery-Event (für die Regression).
insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Hotel-Feedback',current_date,'stay','feedback'),
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Agentur-Galerie',current_date,'agency','gallery');

-- Zwei Feedback-Beiträge auf dem stay-Event: media_url NULL, comment/rating gesetzt, uploaded_at set.
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag, rating, comment) values
  ('f1f1f1f1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','99999999-9999-4999-8999-999999999999',null,null,now(),now(),false,5,'SECRET-G1'),
  ('f2f2f2f2-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888',null,null,now(),now(),false,3,'SECRET-G2');

-- Gallery-Regression: guest1 hat ein Medium auf dem tour/gallery-Event.
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag) values
  ('a1a1a1a1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999','image','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/a1a1a1a1-1111-4111-8111-111111111111/x.jpg',now(),now(),false);

-- TEST-VORBEDINGUNG: Grants für die API-Rollen (idempotent; regulär via 0007).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;

-- ═══ B1 (kritisch): guest2 darf guest1s privaten Feedback-Kommentar NICHT sehen ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  -- guest2 hat selbst Feedback abgegeben -> has_completed_upload(stay)=true. OHNE is_gallery_event
  -- würde public_gallery_select guest1s Zeile zurückgeben. Erwartung mit B1: 0.
  select count(*) into n from public.submissions
    where event_id='55555555-5555-4555-8555-555555555555' and comment='SECRET-G1';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (B1): guest2 sieht guest1s privaten Feedback-Kommentar NICHT';
  else raise notice 'FAIL (B1): LECK — guest2 sieht % fremde Feedback-Zeile(n)', n; end if;
exception when others then reset role; raise notice 'ERR (B1): %', sqlerrm; end $$;

-- ═══ Sanity: guest2 sieht seinen EIGENEN Kommentar (guest_select_own_submission) ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='55555555-5555-4555-8555-555555555555' and comment='SECRET-G2';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (own): guest2 sieht seinen eigenen Feedback-Kommentar';
  else raise notice 'FAIL (own): guest2 sieht eigenen Kommentar nicht (n=%)', n; end if;
exception when others then reset role; raise notice 'ERR (own): %', sqlerrm; end $$;

-- ═══ Gallery-Regression: reziproker Gast sieht Galerie-Beitrag weiterhin ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  -- guest1 hat auf dem gallery-Event hochgeladen -> has_completed_upload=true, is_gallery_event=true.
  select count(*) into n from public.submissions
    where event_id='33333333-3333-4333-8333-333333333333';
  reset role; perform set_config('request.jwt.claims','', true);
  if n >= 1 then raise notice 'PASS (gallery): reziproker Gast sieht die Galerie (% Zeile/n)', n;
  else raise notice 'FAIL (gallery): Galerie leer trotz eigenem Upload'; end if;
exception when others then reset role; raise notice 'ERR (gallery): %', sqlerrm; end $$;

-- ═══ Panel: Tenant sieht BEIDE Feedback-Beiträge (tenant_select_submissions) ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='55555555-5555-4555-8555-555555555555';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 2 then raise notice 'PASS (panel): Tenant sieht beide Feedback-Beiträge';
  else raise notice 'FAIL (panel): Tenant sieht % statt 2', n; end if;
exception when others then reset role; raise notice 'ERR (panel): %', sqlerrm; end $$;

-- ═══ CHECK-Öffnung: stay/feedback erlaubt ═══
do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','ST2',current_date,'stay','feedback');
  raise notice 'PASS (open): stay/feedback-Event angelegt';
exception when others then raise notice 'FAIL (open): stay/feedback abgelehnt — %', sqlerrm; end $$;

-- ═══ CHECK-Sperre: guestbook / wedding bleiben verboten ═══
do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','GB',current_date,'stay','guestbook');
  raise notice 'FAIL (lock): guestbook flow_mode angelegt!';
exception when check_violation then raise notice 'PASS (lock): guestbook abgelehnt — %', sqlerrm;
  when others then raise notice 'ERR (lock-gb): %', sqlerrm; end $$;

do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('11111111-1111-4111-8111-111111111111','WD',current_date,'wedding','gallery');
  raise notice 'FAIL (lock): wedding campaign_type angelegt!';
exception when check_violation then raise notice 'PASS (lock): wedding abgelehnt — %', sqlerrm;
  when others then raise notice 'ERR (lock-wd): %', sqlerrm; end $$;

-- ═══ attach_feedback (0010): Gast hängt rating/comment an EIGENEN Medien-Beitrag ═══
-- Medien-Beitrag von guest1 auf dem stay-Event; rating/comment zunächst NULL (wie nach presign).
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag)
values ('c1c1c1c1-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','99999999-9999-4999-8999-999999999999','image','11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/c1c1c1c1-1111-4111-8111-111111111111/x.jpg',now(),now(),false);

-- Fremd-Gast (guest2) kann NICHT anhängen: RPC gibt NULL, Werte bleiben NULL.
do $$ declare v uuid; r int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('c1c1c1c1-1111-4111-8111-111111111111'::uuid, 4::smallint, 'HACK') into v;
  reset role; perform set_config('request.jwt.claims','', true);
  select rating into r from public.submissions where id='c1c1c1c1-1111-4111-8111-111111111111';
  if v is null and r is null then raise notice 'PASS (attach-foreign): Fremd-Gast kann rating/comment NICHT anhängen';
  else raise notice 'FAIL (attach-foreign): rpc=%, rating=%', v, r; end if;
exception when others then reset role; raise notice 'ERR (attach-foreign): %', sqlerrm; end $$;

-- Eigentümer-Gast (guest1) hängt an: rating/comment werden gesetzt.
do $$ declare v uuid; r int; c text; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select public.attach_feedback('c1c1c1c1-1111-4111-8111-111111111111'::uuid, 4::smallint, 'Sehr gut') into v;
  reset role; perform set_config('request.jwt.claims','', true);
  select rating, comment into r, c from public.submissions where id='c1c1c1c1-1111-4111-8111-111111111111';
  if v = 'c1c1c1c1-1111-4111-8111-111111111111' and r = 4 and c = 'Sehr gut'
    then raise notice 'PASS (attach-own): Eigentümer-Gast hängt rating/comment an seinen Beitrag';
  else raise notice 'FAIL (attach-own): rpc=%, rating=%, comment=%', v, r, c; end if;
exception when others then reset role; raise notice 'ERR (attach-own): %', sqlerrm; end $$;

rollback;
