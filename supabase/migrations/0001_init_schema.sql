-- 0001_init_schema.sql
-- Basis-Schema: tenants, events, submissions + Indizes + current_tenant_id()
-- + grundlegende RLS-Policies (aus docs/20-architecture.md, Abschnitt 1).
--
-- Bewusst OHNE die später ergänzten Spalten: sector/plan (0005) sowie
-- campaign_type/flow_mode/archived_at/comment (0003), guest_name (0004).
-- Die Folge-Migrationen erweitern diese Tabellen per `add column if not exists`
-- und `drop constraint if exists`; deshalb legt 0001 nur den Urzustand an.

-- ─── tenants ──────────────────────────────────────────────────────────────────
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,        -- Unternehmensname
  brand_name  text not null,        -- Markenname auf der Gästeseite
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tenants_user_id_key unique (user_id)
);

-- ─── events ───────────────────────────────────────────────────────────────────
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null,
  date        date not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index events_tenant_created_idx on public.events (tenant_id, created_at desc);
create index events_id_tenant_idx on public.events (id, tenant_id);

-- ─── submissions ──────────────────────────────────────────────────────────────
create table public.submissions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id),
  event_id         uuid not null references public.events (id),
  guest_user_id    uuid not null references auth.users (id),  -- anonyme Auth
  media_url        text,             -- Storage-Pfad; nach Bestätigung gesetzt
  file_type        text not null,    -- 'image' | 'video' (0003 macht dies optional)
  consent_at       timestamptz not null,
  uploaded_at      timestamptz,      -- nach Upload-Bestätigung gesetzt
  moderation_flag  boolean not null default false,
  rating           smallint check (rating between 1 and 5),
  deleted_at       timestamptz,      -- Soft Delete
  created_at       timestamptz not null default now()
);

create index submissions_gallery_idx
  on public.submissions (event_id, tenant_id, moderation_flag, deleted_at)
  where moderation_flag = false and deleted_at is null;
create index submissions_panel_idx
  on public.submissions (tenant_id, event_id, deleted_at);
create index submissions_guest_idx
  on public.submissions (guest_user_id);

-- ─── Hilfsfunktion: tenant_id des aktuellen Auth-Benutzers ────────────────────
-- security definer + leerer search_path (Härtung gegen search_path-Hijacking).
create or replace function public.current_tenant_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select id from public.tenants where user_id = auth.uid()
$$;

-- ─── RLS: tenants ─────────────────────────────────────────────────────────────
alter table public.tenants enable row level security;

create policy "tenant_select_own"
  on public.tenants for select
  using (auth.uid() = user_id);

create policy "tenant_update_own"
  on public.tenants for update
  using (auth.uid() = user_id);

-- ─── RLS: events ──────────────────────────────────────────────────────────────
alter table public.events enable row level security;

create policy "tenant_select_own_events"
  on public.events for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant_insert_own_events"
  on public.events for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant_update_own_events"
  on public.events for update
  using (tenant_id = public.current_tenant_id());

create policy "tenant_delete_own_events"
  on public.events for delete
  using (tenant_id = public.current_tenant_id());

-- Gast: darf aktive Veranstaltungen lesen (Galerieseite). Der API-Handler
-- filtert sensible Felder heraus; zwei SELECT-Policies werden mit OR verknüpft.
create policy "public_select_events"
  on public.events for select
  using (true);

-- ─── RLS: submissions ─────────────────────────────────────────────────────────
alter table public.submissions enable row level security;

-- Tenant: liest und aktualisiert alle Submissions seiner Veranstaltungen
create policy "tenant_select_submissions"
  on public.submissions for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant_update_submissions"
  on public.submissions for update
  using (tenant_id = public.current_tenant_id());

-- Gast: eigene Submission anlegen / lesen / löschen (DSGVO-Löschpfad)
create policy "guest_insert_submission"
  on public.submissions for insert
  with check (guest_user_id = auth.uid());

create policy "guest_select_own_submission"
  on public.submissions for select
  using (guest_user_id = auth.uid());

create policy "guest_delete_own_submission"
  on public.submissions for delete
  using (guest_user_id = auth.uid());

-- Galerie: nicht geflaggte, nicht gelöschte Submissions öffentlich lesbar.
-- Wird in 0002 durch die Reziprozitäts-Variante ersetzt.
create policy "public_gallery_select"
  on public.submissions for select
  using (moderation_flag = false and deleted_at is null);
