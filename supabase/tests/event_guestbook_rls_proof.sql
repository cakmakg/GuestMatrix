-- event_guestbook_rls_proof.sql — Nachweis für 0018 (Sektor event / wedding / guestbook).
-- GESCHLOSSENES Gästebuch: ein Gast sieht nur seinen EIGENEN Gruß; alle Grüße sieht nur das
-- Brautpaar (Tenant-Owner). Kein gast-sichtbarer Fremd-Read → deckt sich mit dem Consent-Text.
--
-- Szenarien:
--   (a) B1 (kritisch, ZWEI-GÄSTE, keine leere Galerie): guest2 hat SELBST einen Gruß hinterlassen
--       (has_completed_upload=true) und kann guest1s privaten Gruß (Name+Nachricht) TROTZDEM nicht
--       über public_gallery_select ziehen — is_gallery_event ist für guestbook FALSE (echte
--       Gate-Ablehnung, kein leeres Ergebnis). Sanity: guest2 sieht seinen EIGENEN Gruß.
--   (b) Cross-Tenant: ein Tourismus-Operator sieht die Grüße des Event-Tenants NICHT.
--   (c) Tourismus-Regression: agency/gallery + stay/feedback weiterhin anlegbar, reziproke Galerie
--       sichtbar; gesperrte Werte (real_estate, property) weiterhin per CHECK abgelehnt.
--   (d) business_type-Interaktion: (d1) Event-Tenant (business_type NULL) legt sein wedding-Event
--       per RLS frei an (WITH CHECK erlaubt NULL); (d2) ein Tourismus-HOTEL (business_type=hotel)
--       kann per RLS KEIN wedding-Event anlegen (die 0017-WITH-CHECK-Grenze bleibt aktiv, nicht
--       vacuously wahr).
--   (e) Dashboard/Registry: der Event-Tenant hat sector='event' + business_type NULL → daraus leitet
--       lib/sectors allowedCampaignTypes=['wedding'] ab (Enumeration in tests/sectors.test.ts fixiert;
--       hier wird nur die DB-Zeilenform belegt, aus der das Dashboard liest).
--   (f) Signup-Trigger: eine Registrierung mit sector='event' erzeugt einen Tenant mit
--       sector='event', business_type NULL (handle_new_user-Allowlist, 0017).
--
-- Ausführen NACH `npx supabase db reset`. EINE Transaktion mit ROLLBACK am Ende.

begin;

-- ── Seed (als DB-Owner; RLS wird für den Aufbau umgangen) ────────────────────────
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','authenticated','authenticated','op-event@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','op-agency@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','op-hotel@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','guest1@example.com',now(),now()),
  ('00000000-0000-0000-0000-000000000000','88888888-8888-4888-8888-888888888888','authenticated','authenticated','guest2@example.com',now(),now());

-- Event-Tenant: sector='event', business_type NULL (0018 öffnet den sector-CHECK; der 0017-
-- business_type-CHECK erlaubt nicht-tourism → NULL). Tourismus-Tenants für Regression/Grenze.
insert into public.tenants (id, user_id, name, brand_name, sector, business_type, plan) values
  ('e1e1e1e1-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Wedding Co','Marke Event','event',null,'free'),
  ('a2a2a2a2-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Agentur A','Marke A','tourism','agency','free'),
  ('c3c3c3c3-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Hotel H','Marke H','tourism','hotel','free');

-- Ein wedding/guestbook-Event (Event-Tenant) und ein agency/gallery-Event (Regression).
insert into public.events (id, tenant_id, name, date, campaign_type, flow_mode) values
  ('44444444-4444-4444-8444-444444444444','e1e1e1e1-1111-4111-8111-111111111111','Hochzeit Anna & Ben',current_date,'wedding','guestbook'),
  ('33333333-3333-4333-8333-333333333333','a2a2a2a2-2222-4222-8222-222222222222','Agentur-Galerie',current_date,'agency','gallery');

-- Zwei Gästebuch-Grüße auf dem wedding-Event: guest_name + comment gesetzt, media_url NULL,
-- uploaded_at gesetzt (der guestbook-Gruß markiert den Beitrag als abgeschlossen → beide Gäste
-- erfüllen has_completed_upload für dieses Event).
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag, guest_name, comment) values
  ('f1f1f1f1-1111-4111-8111-111111111111','e1e1e1e1-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','99999999-9999-4999-8999-999999999999',null,null,now(),now(),false,'G1-NAME','SECRET-G1-MSG'),
  ('f2f2f2f2-2222-4222-8222-222222222222','e1e1e1e1-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','88888888-8888-4888-8888-888888888888',null,null,now(),now(),false,'G2-NAME','SECRET-G2-MSG');

-- Gallery-Regression: guest1 hat ein Medium auf dem agency/gallery-Event.
insert into public.submissions (id, tenant_id, event_id, guest_user_id, file_type, media_url, consent_at, uploaded_at, moderation_flag) values
  ('a1a1a1a1-1111-4111-8111-111111111111','a2a2a2a2-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999','image','a2a2a2a2-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/a1a1a1a1-1111-4111-8111-111111111111/x.jpg',now(),now(),false);

-- TEST-VORBEDINGUNG: Grants für die API-Rollen (idempotent; regulär via 0007).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tenants, public.events, public.submissions to anon, authenticated;

-- ═══ (a) B1 (kritisch): guest2 darf guest1s privaten Gästebuch-Gruß NICHT sehen ═══
do $$ declare n_msg int; n_name int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  -- guest2 hat selbst einen Gruß abgegeben → has_completed_upload(wedding)=true. OHNE is_gallery_event
  -- würde public_gallery_select guest1s Zeile zurückgeben. Erwartung mit B1: 0 (Nachricht UND Name).
  select count(*) into n_msg from public.submissions
    where event_id='44444444-4444-4444-8444-444444444444' and comment='SECRET-G1-MSG';
  select count(*) into n_name from public.submissions
    where event_id='44444444-4444-4444-8444-444444444444' and guest_name='G1-NAME';
  reset role; perform set_config('request.jwt.claims','', true);
  if n_msg = 0 and n_name = 0 then raise notice 'PASS (a): guest2 sieht guest1s Gruß (Nachricht+Name) NICHT (echte Gate-Ablehnung trotz has_completed_upload)';
  else raise notice 'FAIL (a): LECK — guest2 sieht fremde Zeilen (msg=%, name=%)', n_msg, n_name; end if;
exception when others then reset role; raise notice 'ERR (a): %', sqlerrm; end $$;

-- ═══ (a-Sanity): guest2 sieht seinen EIGENEN Gruß (guest_select_own_submission) ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='44444444-4444-4444-8444-444444444444' and comment='SECRET-G2-MSG';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (a-own): guest2 sieht seinen eigenen Gruß';
  else raise notice 'FAIL (a-own): guest2 sieht eigenen Gruß nicht (n=%)', n; end if;
exception when others then reset role; raise notice 'ERR (a-own): %', sqlerrm; end $$;

-- ═══ (b) Cross-Tenant: Tourismus-Operator sieht die Event-Grüße NICHT ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='44444444-4444-4444-8444-444444444444';
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 0 then raise notice 'PASS (b): fremder Tenant sieht die Gästebuch-Grüße des Event-Tenants NICHT';
  else raise notice 'FAIL (b): Cross-Tenant-Leck — % Zeile(n)', n; end if;
exception when others then reset role; raise notice 'ERR (b): %', sqlerrm; end $$;

-- ═══ (c) Tourismus-Regression: reziproke Galerie weiterhin sichtbar ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.submissions
    where event_id='33333333-3333-4333-8333-333333333333';
  reset role; perform set_config('request.jwt.claims','', true);
  if n >= 1 then raise notice 'PASS (c-gallery): reziproker Gast sieht die Agentur-Galerie (% Zeile/n)', n;
  else raise notice 'FAIL (c-gallery): Galerie leer trotz eigenem Upload'; end if;
exception when others then reset role; raise notice 'ERR (c-gallery): %', sqlerrm; end $$;

-- ═══ (c) CHECK-Öffnung: agency/gallery, stay/feedback UND wedding/guestbook anlegbar ═══
do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('a2a2a2a2-2222-4222-8222-222222222222','AG2',current_date,'agency','gallery');
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('c3c3c3c3-3333-4333-8333-333333333333','ST2',current_date,'stay','feedback');
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('e1e1e1e1-1111-4111-8111-111111111111','WD2',current_date,'wedding','guestbook');
  raise notice 'PASS (c-open): agency/gallery + stay/feedback + wedding/guestbook angelegt';
exception when others then raise notice 'FAIL (c-open): ein aktiver Typ wurde abgelehnt — %', sqlerrm; end $$;

-- ═══ (c) CHECK-Sperre: real_estate-Sektor und property-Kampagnentyp bleiben verboten ═══
do $$ begin
  insert into public.tenants (user_id,name,brand_name,sector,plan)
    values ('99999999-9999-4999-8999-999999999999','RE','Marke RE','real_estate','free');
  raise notice 'FAIL (c-lock-sector): real_estate-Tenant angelegt!';
exception when check_violation then raise notice 'PASS (c-lock-sector): real_estate abgelehnt — %', sqlerrm;
  when others then raise notice 'ERR (c-lock-sector): %', sqlerrm; end $$;

do $$ begin
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('e1e1e1e1-1111-4111-8111-111111111111','PROP',current_date,'property','gallery');
  raise notice 'FAIL (c-lock-campaign): property campaign_type angelegt!';
exception when check_violation then raise notice 'PASS (c-lock-campaign): property abgelehnt — %', sqlerrm;
  when others then raise notice 'ERR (c-lock-campaign): %', sqlerrm; end $$;

-- ═══ (d1) business_type NULL blockt NICHT: Event-Tenant legt wedding-Event per RLS an ═══
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('e1e1e1e1-1111-4111-8111-111111111111','Hochzeit Live',current_date,'wedding','guestbook');
  get diagnostics n = row_count;
  reset role; perform set_config('request.jwt.claims','', true);
  if n = 1 then raise notice 'PASS (d1): Event-Tenant (business_type NULL) legt sein wedding-Event an — WITH CHECK erlaubt NULL';
  else raise notice 'FAIL (d1): wedding-Insert row_count=%', n; end if;
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (d1): wedding-Insert des Event-Tenants abgelehnt — %', sqlerrm; end $$;

-- ═══ (d2) Grenze aktiv: Tourismus-HOTEL kann per RLS KEIN wedding-Event anlegen ═══
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
  set local role authenticated;
  -- current_tenant_allows_campaign('wedding') ist für business_type=hotel FALSE → WITH CHECK verletzt.
  insert into public.events (tenant_id,name,date,campaign_type,flow_mode)
    values ('c3c3c3c3-3333-4333-8333-333333333333','HotelWed',current_date,'wedding','guestbook');
  reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'FAIL (d2): Hotel-Tenant konnte ein wedding-Event anlegen (business_type-Grenze umgangen)!';
exception when others then reset role; perform set_config('request.jwt.claims','', true);
  raise notice 'PASS (d2): WITH CHECK blockt Hotel→wedding (Grenze nicht vacuously wahr) — %', sqlerrm; end $$;

-- ═══ (e) Dashboard/Registry-Zeilenform: Event-Tenant hat sector='event', business_type NULL ═══
do $$ declare v_sector text; v_bt text; begin
  select sector, business_type into v_sector, v_bt from public.tenants
    where id='e1e1e1e1-1111-4111-8111-111111111111';
  if v_sector = 'event' and v_bt is null
    then raise notice 'PASS (e): Event-Tenant sector=event, business_type NULL → Dashboard leitet [wedding] ab (Enum in sectors.test.ts)';
  else raise notice 'FAIL (e): sector=%, business_type=%', v_sector, v_bt; end if;
end $$;

-- ═══ (f) Signup-Trigger: Registrierung mit sector='event' erzeugt event-Tenant (business_type NULL) ═══
do $$ declare v_sector text; v_bt text; begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000','f0f0f0f0-0000-4000-8000-000000000000','authenticated','authenticated',
          'wedding-signup@example.com','{"brand_name":"Neue Hochzeitsfirma","sector":"event"}'::jsonb, now(), now());
  select sector, business_type into v_sector, v_bt from public.tenants
    where user_id='f0f0f0f0-0000-4000-8000-000000000000';
  if v_sector = 'event' and v_bt is null
    then raise notice 'PASS (f): Signup-Trigger legt event-Tenant an (sector=event, business_type NULL)';
  else raise notice 'FAIL (f): Tenant sector=%, business_type=%', v_sector, v_bt; end if;
exception when others then raise notice 'ERR (f): %', sqlerrm; end $$;

rollback;
