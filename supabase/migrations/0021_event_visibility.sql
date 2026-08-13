-- 0021_event_visibility.sql
-- Dilim B (docs/wedding-enrichment-plan.md): neue, zu `flow_mode` ORTHOGONALE Achse
-- `events.visibility`. Bisher galt für jedes Gästebuch dasselbe geschlossene Modell (0018): ein
-- Gast sieht nur den eigenen Gruß, alle Grüße nur das Brautpaar. Diese Migration gibt dem
-- Veranstalter die Wahl, sein Gästebuch für alle Gäste der Feier zu öffnen — ohne die 0018-Garantie
-- als STANDARD zu verändern (Default bleibt 'private' = heutiges Verhalten).
--
-- 'private' | 'shared' | 'moderated'. 'moderated' verhält sich in dieser Migration wie 'shared'
-- (gleiches moderation_flag=false-Prädikat) — die eigentliche Freigabe-vor-Anzeige-Umkehr +
-- Freigabe-Queue ist Dilim D. Hier wird der Wert nur schon zugelassen, um nicht dieselbe
-- CHECK-Spalte drei Mal anzufassen.
--
-- Kein Reciprocity-Gate (has_completed_upload) auf dem neuen Lesepfad: FLOW_MODE_CAPABILITIES
-- .guestbook.reciprocityEnabled ist bereits false (lib/sectors/types.ts) — ein Gast muss nicht
-- selbst beigetragen haben, um bei shared/moderated mitzulesen.
--
-- ATOMAR (eine Transaktion): Spalte + CHECK + RLS-Neu-Audit + Immutability in DERSELBEN Migration
-- (Muster 0017/0018). Voraussetzung: 0001..0020. Idempotent (add column if not exists;
-- constraint/function/policy drop+recreate).

-- ── 1) Spalte ─────────────────────────────────────────────────────────────────
-- Default füllt Bestandszeilen automatisch (Postgres-Fast-Default) — keine separate Backfill-UPDATE
-- nötig. 'private' entspricht exakt dem bisherigen (einzigen) Verhalten aller Events.
alter table public.events add column if not exists visibility text not null default 'private';

comment on column public.events.visibility is
  'Sichtbarkeitsachse (orthogonal zu flow_mode): private (Default, nur Betreiber liest) | shared | moderated (beide: Gäste lesen mit, nur guestbook). Unveränderlich nach dem Anlegen (siehe tenant_update_own_events).';

-- ── 2) CHECK: gültige Werte + nur guestbook-Events dürfen ≠ private sein ───────
-- Verhindert einen sinnlosen Zustand (z. B. agency/gallery mit visibility='moderated') ohne
-- Sonderfall-Code — die Grenze lebt allein in der DB, wie campaign_type/flow_mode.
alter table public.events drop constraint if exists events_visibility_check;
alter table public.events
  add constraint events_visibility_check
  check (
    visibility in ('private', 'shared', 'moderated')
    and (visibility = 'private' or flow_mode = 'guestbook')
  );

-- ── 3) B1-artiger Helfer: wann öffnet sich der Gästebuch-Lesepfad für Gäste ─────
-- Security-definer + stable + leerer search_path (Muster is_gallery_event, 0009/0018).
create or replace function public.is_shared_guestbook_event(p_event_id uuid)
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
      and e.flow_mode = 'guestbook'
      and e.visibility in ('shared', 'moderated')
  )
$$;

-- ── 4) Neue gast-sichtbare SELECT-Policy für geöffnete Gästebücher ──────────────
-- Analog public_gallery_select (0009/0018), aber OHNE has_completed_upload (kein Reciprocity-Gate
-- im Gästebuch) und über den neuen Helfer statt is_gallery_event (guestbook ≠ gallery bleibt strikt
-- getrennt; is_gallery_event ist von dieser Migration unberührt).
drop policy if exists "public_guestbook_select" on public.submissions;
create policy "public_guestbook_select"
  on public.submissions for select
  using (
    moderation_flag = false
    and deleted_at is null
    and uploaded_at is not null
    and public.is_shared_guestbook_event(event_id)
  );

-- ── 5) Helfer: gespeicherten visibility-Wert lesen (für die Immutability-Grenze) ─
-- Gleiches Muster wie current_tenant_business_type/current_tenant_sector (0017): security definer
-- liest den aktuell in der Tabelle stehenden Wert, unabhängig vom NEW-Wert des laufenden UPDATE.
create or replace function public.stored_event_visibility(p_event_id uuid)
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select visibility from public.events where id = p_event_id
$$;

-- ── 6) Immutability: visibility ist nach dem Anlegen für den Kunden FEST ────────
-- tenant_insert_own_events (0017) bleibt unverändert — der CHECK aus Schritt 2 reicht beim Insert.
-- tenant_update_own_events wird neu erstellt: dieselbe Ownership+business_type-Grenze wie 0017,
-- PLUS visibility = gespeicherter Wert. Ein Kunde kann sein Event also weiterhin archivieren/
-- umbenennen, aber visibility über KEINEN Pfad (auch nicht direktes PostgREST-UPDATE) ändern.
drop policy if exists "tenant_update_own_events" on public.events;
create policy "tenant_update_own_events"
  on public.events for update
  using (tenant_id = public.current_tenant_id())
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_tenant_allows_campaign(campaign_type)
    and visibility = public.stored_event_visibility(id)
  );
