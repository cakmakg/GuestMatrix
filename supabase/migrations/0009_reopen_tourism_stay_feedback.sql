-- 0009_reopen_tourism_stay_feedback.sql
-- T2: Öffnet innerhalb des tourism-Sektors den Kampagnentyp `stay` (Flow-Modus `feedback`),
-- zusätzlich zum bestehenden tour/gallery. Der Sektor bleibt auf 'tourism' beschränkt;
-- real_estate/event und der Modus guestbook bleiben gesperrt.
--
-- ATOMAR mit dem B1-Sicherheits-Audit: dieselbe Migration erweitert public_gallery_select um
-- eine flow_mode='gallery'-Bedingung (via SECURITY-DEFINER-Helfer is_gallery_event), damit
-- Feedback-Beiträge (private Hotel-Kommentare/Bewertungen) NIE über die Gäste-Galerie an
-- andere Gäste gelangen — kein offenes Fenster zwischen CHECK-Öffnung und Policy-Fix.
--
-- Voraussetzung: 0001..0008. Keine cloud-spezifischen GRANTs (der Helfer folgt has_completed_upload,
-- das ohne expliziten Grant funktioniert; PUBLIC-EXECUTE per Default genügt für die Policy-Auswertung).

-- ── 1) CHECK-Constraints erweitern (Sektor bleibt 'tourism') ───────────────────
alter table public.events drop constraint if exists events_campaign_type_check;
alter table public.events add constraint events_campaign_type_check
  check (campaign_type in ('tour', 'stay'));

alter table public.events drop constraint if exists events_flow_mode_check;
alter table public.events add constraint events_flow_mode_check
  check (flow_mode in ('gallery', 'feedback'));

-- tenants_sector_check bleibt unverändert ('tourism'); real_estate/event bleiben gesperrt.

-- ── 2) B1: flow_mode-Gate für die Gäste-Galerie ───────────────────────────────
-- submissions trägt kein flow_mode (das liegt in events). SECURITY DEFINER wie
-- has_completed_upload: bricht die RLS-Rekursion und ist unabhängig von der events-RLS.
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

-- public_gallery_select neu: NUR gallery-Events erreichen die Gäste-Galerie. Feedback-Beiträge
-- (comment/rating, media_url NULL) bleiben für Gäste unsichtbar — auch für Gäste, die selbst
-- Feedback zum selben Event abgegeben haben (has_completed_upload wäre sonst true → Leck).
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
