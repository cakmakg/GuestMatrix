-- 0002_reciprocity_and_storage.sql
-- Reziprozitäts-Sperre auf RLS-Ebene + Storage-Bucket `ugc-media` mit Größenlimit.
-- Quelle: docs/plan-consent-upload-reciprocity.md (Kriterien 3 & 4).
--
-- Voraussetzung: 0001_init_schema.sql. Erweitert/ersetzt die Basis-Policy
-- `public_gallery_select` und legt Storage-Objekte an.

-- ─── has_completed_upload() ───────────────────────────────────────────────────
-- Prüft, ob auth.uid() für das Event einen abgeschlossenen (uploaded_at not null,
-- deleted_at null) Beitrag hat. security definer bricht die RLS-Rekursion
-- (Abfrage auf submissions innerhalb einer submissions-Policy).
create or replace function public.has_completed_upload(p_event_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.submissions
    where event_id = p_event_id
      and guest_user_id = auth.uid()
      and uploaded_at is not null
      and deleted_at is null
  )
$$;

-- ─── public_gallery_select: Reziprozität in RLS ───────────────────────────────
-- Die Galerie wird erst sichtbar, nachdem der Gast selbst hochgeladen hat.
drop policy if exists "public_gallery_select" on public.submissions;
create policy "public_gallery_select"
  on public.submissions for select
  using (
    moderation_flag = false
    and deleted_at is null
    and uploaded_at is not null
    and public.has_completed_upload(event_id)
  );

-- ─── Storage-Bucket: ugc-media ────────────────────────────────────────────────
-- Privat, 50 MiB Upload-Limit (52428800 Bytes), MIME-Allowlist. Das Limit erzwingt
-- Supabase Storage beim PUT — der Client kann es nicht umgehen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ugc-media',
  'ugc-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- ─── Storage-RLS (Tenant-Präfix) ──────────────────────────────────────────────
-- Pfad: {tenant_id}/{event_id}/{submission_id}/{uuid}.{ext}
-- foldername(name)[1] = tenant_id. Der Gast lädt über den Signed-Upload-Token
-- hoch (kein INSERT-Policy nötig); der Tenant liest/löscht sein eigenes Präfix.
create policy "tenant_read_own_media"
  on storage.objects for select
  using (
    bucket_id = 'ugc-media'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "tenant_delete_own_media"
  on storage.objects for delete
  using (
    bucket_id = 'ugc-media'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
