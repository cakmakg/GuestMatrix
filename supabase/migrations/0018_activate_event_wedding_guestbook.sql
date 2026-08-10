-- 0018_activate_event_wedding_guestbook.sql
-- Aktiviert den Sektor `event` (Hochzeit/Event) + Kampagnentyp `wedding` + Flow-Modus `guestbook`.
-- Tourismus (hotel/agency; stay/gallery/agency-Feedback) UND business_type bleiben UNVERÄNDERT.
-- real_estate sowie der dormante Sektor `agency` (lib/sectors/agency/) bleiben CHECK-gesperrt.
--
-- Sichtbarkeitsmodell (bewusste Produktentscheidung): GESCHLOSSENES Gästebuch. Ein Gast sieht nur
-- seinen EIGENEN Gruß (guest_select_own_submission); alle Grüße sieht ausschließlich das Brautpaar
-- (Tenant-Owner, tenant_select_submissions). Das deckt sich mit dem Consent-Text (FLOW_MODE_LABELS
-- .guestbook): „…dem Veranstalter (Brautpaar) gezeigt". Es gibt daher KEINE gast-sichtbare
-- Fremd-Leseregel für guestbook — kein neuer Policy-Eintrag nötig.
--
-- ATOMAR (eine Transaktion): CHECK-Erweiterung + B1-RLS-Audit in DERSELBEN Migration (Muster 0009).
-- Voraussetzung: 0001..0017. Idempotent (constraint/policy/function drop+recreate).
-- Hinweis: Diese CHECK-Erweiterungen sind WIDENING (nur zusätzliche erlaubte Werte) — sie können
-- bestehende Cloud-Zeilen NICHT verletzen; ein Vor-Zustands-Diagnostic wie bei 0016/0017 (die
-- verengten bzw. NOT-NULL-artig zwangen) ist hier nicht nötig.

-- ── 1) CHECK-Constraints erweitern ─────────────────────────────────────────────
-- tenants.sector: tourism + event (real_estate/agency bleiben gesperrt).
alter table public.tenants drop constraint if exists tenants_sector_check;
alter table public.tenants
  add constraint tenants_sector_check
  check (sector in ('tourism', 'event'));

-- events.campaign_type: agency, stay + wedding (property/trip bleiben gesperrt).
alter table public.events drop constraint if exists events_campaign_type_check;
alter table public.events
  add constraint events_campaign_type_check
  check (campaign_type in ('agency', 'stay', 'wedding'));

-- events.flow_mode: gallery, feedback + guestbook.
alter table public.events drop constraint if exists events_flow_mode_check;
alter table public.events
  add constraint events_flow_mode_check
  check (flow_mode in ('gallery', 'feedback', 'guestbook'));

-- tenants_business_type_check (0017) bleibt UNVERÄNDERT: es erlaubt bereits
--   (sector <> 'tourism' AND business_type IS NULL)
-- → ein event-Tenant mit business_type = NULL passt ohne Änderung durch.
-- handle_new_user (0017) führt 'event' bereits in der Sektor-Allowlist und setzt business_type = NULL
-- für nicht-tourism-Sektoren → KEINE Trigger-Änderung nötig; das Öffnen des sector-CHECK genügt.

-- ── 2) B1-Sicherheits-Audit: Gästebuch-Grüße dürfen NIE in die Gäste-Galerie ────
-- guestbook-Submissions tragen guest_name + comment (private Grüße ans Brautpaar). Der EINZIGE
-- gast-sichtbare Fremd-Read ist public_gallery_select; er ist seit 0009 flow-mode-aware über den
-- SECURITY-DEFINER-Helfer is_gallery_event (nur flow_mode = 'gallery'). Da guestbook-Events
-- flow_mode = 'guestbook' haben, liefert is_gallery_event FALSE → guestbook-Zeilen erreichen die
-- Galerie NICHT, auch nicht für reziproke Gäste (has_completed_upload = true; der guestbook-Gruß
-- setzt uploaded_at). Defensiv IDENTISCH neu erstellt (Selbst-Dokumentation, KEIN Verhaltens-
-- wechsel), damit die Garantie mit der CHECK-Öffnung ko-lokalisiert ist und nicht still driftet.
-- Nachweis: event_guestbook_rls_proof.sql (a).
create or replace function public.is_gallery_event(p_event_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.flow_mode = 'gallery'
  )
$$;

drop policy if exists "public_gallery_select" on public.submissions;
create policy "public_gallery_select"
  on public.submissions for select
  using (
    moderation_flag = false
    and deleted_at is null
    and uploaded_at is not null
    and public.is_gallery_event(event_id)
    and public.has_completed_upload(event_id)
  );
