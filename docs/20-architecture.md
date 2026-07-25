# GuestMatrix — Phase-0-Architektur

> **Entscheidung:** MongoDB → Supabase (Postgres + RLS + Supabase Auth + Supabase Storage).
> NextAuth und sessionToken-Mechanismus wurden entfernt. Gesamte Authentifizierung in Supabase.

---

## 1. Postgres-Datenmodell

### Allgemeines Prinzip

Tenant-Isolierung wird nicht auf Anwendungsebene, sondern auf Postgres-Ebene über
**Row Level Security (RLS)** sichergestellt. RLS ist auf jeder Tabelle aktiv; Tabellen
ohne Policy sind nicht erreichbar. Der `supabase-js`-Client arbeitet stets mit dem JWT
des angemeldeten Benutzers; dadurch greifen die Policies automatisch.

---

### Tabelle: `tenants`

```sql
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,        -- Unternehmensname
  brand_name  text not null,        -- Markenname, der auf der Gästeseite angezeigt wird
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tenants_user_id_key unique (user_id)
);
```

**Beziehung:** `auth.users` ↔ `tenants` → 1:1. Jeder Unternehmensbenutzer in Supabase Auth
entspricht einer Zeile in dieser Tabelle.

**Index:** `user_id` (der Unique Constraint erzeugt bereits einen Index)

**RLS:**

```sql
alter table tenants enable row level security;

-- Tenant liest seine eigene Zeile
create policy "tenant_select_own"
  on tenants for select
  using (auth.uid() = user_id);

-- Tenant aktualisiert seine eigene Zeile
create policy "tenant_update_own"
  on tenants for update
  using (auth.uid() = user_id);
```

---

### Tabelle: `events`

```sql
create table events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  date        date not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

**Indizes:**

```sql
create index events_tenant_created_idx on events (tenant_id, created_at desc);
create index events_id_tenant_idx      on events (id, tenant_id);
```

**RLS:**

```sql
alter table events enable row level security;

-- Hilfsfunktion: gibt die tenant_id des aktuellen Auth-Benutzers zurück
-- (sauberer als Subquery in jeder Policy)
create or replace function current_tenant_id()
  returns uuid language sql stable security definer as
$$
  select id from tenants where user_id = auth.uid()
$$;

create policy "tenant_select_own_events"
  on events for select
  using (tenant_id = current_tenant_id());

create policy "tenant_insert_own_events"
  on events for insert
  with check (tenant_id = current_tenant_id());

create policy "tenant_update_own_events"
  on events for update
  using (tenant_id = current_tenant_id());

create policy "tenant_delete_own_events"
  on events for delete
  using (tenant_id = current_tenant_id());

-- Gast: darf Veranstaltungsinformationen lesen (für die Galerieseite)
-- Kein deleted_at; alle aktiven Veranstaltungen sind öffentlich lesbar
create policy "public_select_events"
  on events for select
  using (true);
-- Hinweis: zwei SELECT-Policies werden mit OR verknüpft; Tenant liest eigene + alle lesen.
-- Der Gast erhält nur name und description — der API-Handler filtert sensible Felder heraus.
```

---

### Tabelle: `submissions`

```sql
create table submissions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id),
  event_id         uuid not null references events(id),
  guest_user_id    uuid not null references auth.users(id),  -- anonyme Auth
  media_url        text,            -- Supabase-Storage-Pfad; wird nach Bestätigung gesetzt
  file_type        text not null,   -- 'image' | 'video'
  consent_at       timestamptz not null,
  uploaded_at      timestamptz,
  moderation_flag  boolean not null default false,
  rating           smallint check (rating between 1 and 5),
  deleted_at       timestamptz,     -- Soft Delete
  created_at       timestamptz not null default now()
);
```

**Indizes:**

```sql
-- Galerieabfrage (Gast)
create index submissions_gallery_idx
  on submissions (event_id, tenant_id, moderation_flag, deleted_at)
  where moderation_flag = false and deleted_at is null;

-- Submission-Liste im Dashboard (Unternehmen)
create index submissions_panel_idx
  on submissions (tenant_id, event_id, deleted_at);

-- Zugriff des Gastes auf seine eigenen Submissions
create index submissions_guest_idx
  on submissions (guest_user_id);
```

**RLS:**

```sql
alter table submissions enable row level security;

-- Tenant: liest und aktualisiert alle Submissions seiner Veranstaltungen
create policy "tenant_select_submissions"
  on submissions for select
  using (tenant_id = current_tenant_id());

create policy "tenant_update_submissions"
  on submissions for update
  using (tenant_id = current_tenant_id());

-- Gast: darf eigene Submission erstellen
create policy "guest_insert_submission"
  on submissions for insert
  with check (guest_user_id = auth.uid());

-- Gast: darf eigene Submission lesen
create policy "guest_select_own_submission"
  on submissions for select
  using (guest_user_id = auth.uid());

-- Gast: darf eigene Submission löschen (DSGVO-Löschpfad)
create policy "guest_delete_own_submission"
  on submissions for delete
  using (guest_user_id = auth.uid());

-- Galerie: nicht geflaggte und nicht gelöschte Submissions sind öffentlich lesbar
create policy "public_gallery_select"
  on submissions for select
  using (moderation_flag = false and deleted_at is null);
```

---

### Tabellenbeziehungen

```
auth.users (Supabase Auth)
    │ 1:1
    ▼
tenants
    │ 1:N
    ▼
events
    │ 1:N
    ▼
submissions ◄── auth.users (anonymer Gast, guest_user_id)
```

`submissions.tenant_id` wird denormalisiert gespeichert. Grund: RLS-Prüfungen können
direkt erfolgen, ohne bei jeder Submission-Abfrage einen JOIN auf `events` durchzuführen.

---

## 2. Auth-Strategie

### Unternehmens-Dashboard (Reiseleiter/Operator)

```typescript
// Anmeldung
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})
```

- Supabase Auth verwaltet den kompletten E-Mail- + Passwort-Ablauf. Passwort-Hashing,
  Session-Token und Refresh-Mechanismus liegen auf Supabase-Seite.
- Passwort-Zurücksetzen: `supabase.auth.resetPasswordForEmail(email)` — Supabase sendet
  einen zeitlich begrenzten Magic Link, kein eigener Anwendungscode erforderlich.
- Geschützte Routen: Session wird in der Next.js-Middleware mit `supabase.auth.getUser()`
  validiert; ohne Session wird auf `/login` weitergeleitet.
- Tenant-Informationen liegen nicht in der Session, sondern werden aus der Tabelle `tenants`
  per `user_id`-Join abgerufen: `SELECT id FROM tenants WHERE user_id = auth.uid()`.
- In Phase 0 kein Self-serve-Signup; Reiseleiter werden manuell über das Supabase-Dashboard
  angelegt (`auth.users` + `tenants`-Eintrag gemeinsam).

### Gast (anonym)

```typescript
// Nach Consent-Bestätigung
const { data, error } = await supabase.auth.signInAnonymously()
// data.user.id → wird als guest_user_id in die submissions-Tabelle geschrieben
```

- `signInAnonymously()` erstellt in Supabase Auth einen echten Benutzereintrag und gibt
  ein anonymes JWT zurück.
- Mit diesem JWT lösen RLS-Policies die Bedingung `auth.uid() = guest_user_id` automatisch auf.
  Kein httpOnly-Cookie oder benutzerdefinierter sessionToken-Mechanismus erforderlich.
- Die Gäste-Session wird vom Supabase-Client verwaltet (localStorage oder Cookie, je nach Plattform).
- Sicherheitsgrenze: Der Gast kann nur Submissions sehen/löschen, bei denen
  `guest_user_id = auth.uid()`. Auf Inhalte anderer Gäste ist auf RLS-Ebene kein Zugriff möglich.

---

## 3. Media-Upload-Ablauf

### Supabase Storage Presigned Upload

```
Client                    Next.js API              Supabase Storage
  │                           │                          │
  │── POST /api/submissions ──▶│                          │
  │   /presign                │                          │
  │   { eventId, fileName,    │                          │
  │     fileType, consentAt } │                          │
  │   [zod validiert]         │                          │
  │                           │── createSignedUploadUrl ─▶│
  │                           │◀── { signedUrl, token }  │
  │◀── { signedUrl,           │                          │
  │      submissionId } ──────│                          │
  │                           │                          │
  │── PUT <signedUrl> ────────────────────────────────────▶│
  │   (Datei direkt)          │                          │
  │◀── 200 OK ────────────────────────────────────────────│
  │                           │                          │
  │── PATCH /api/submissions ─▶│                          │
  │   /[id]/confirm           │                          │
  │                           │── submissions UPDATE      │
  │                           │   (uploaded_at, media_url)│
  │◀── { mediaUrl } ──────────│                          │
```

### Supabase Storage Konfiguration

```
Bucket: ugc-media  (privat)
Pfad:   {tenant_id}/{event_id}/{submission_id}/{uuid}.{ext}
```

- Bucket ist **privat**; keine öffentliche URL. Zum Herunterladen wird mit `createSignedUrl()`
  eine zeitlich begrenzte URL erzeugt.
- Bucket-Policy (Storage RLS):
  - Tenant darf Dateien unter dem eigenen `{tenant_id}/`-Präfix lesen und löschen.
  - Gast darf nur auf den mit `createSignedUploadUrl` erhaltenen Pfad hochladen
    (Token ist einmalig verwendbar).
- Löschen: `supabase.storage.from('ugc-media').remove([path])` wird zusammen mit dem
  Setzen von `submissions.deleted_at` aufgerufen.

### Dateieinschränkungen

- Zugelassene MIME-Typen: `image/jpeg`, `image/png`, `video/mp4`, `video/quicktime`
- Max. Größe: 50 MB (als Supabase-Storage-Upload-Limit gesetzt)
- Dateityp wird serverseitig validiert; reine Extension-Prüfung reicht nicht aus.

---

## 4. ADR-001 — Warum kein separates Backend?

**Entscheidung:** Der gesamte API-Bedarf von Phase 0 wird mit Next.js App Router Route Handlern
abgedeckt. Es wird kein separater Node/Express/FastAPI-Dienst betrieben.

**Kontext:**

- Phase-0-Last: kleine Touroperatoren, geringe gleichzeitige Nutzerzahl, einige Dutzend
  Uploads pro Veranstaltung.
- Team: ein Entwickler; zwei separate Dienste = zwei Deploy-Pipelines, zwei CORS-Konfigurationen,
  zwei Secret-Verwaltungen.

**Begründung:**

1. **Komplexitätskosten sind nicht vernachlässigbar.** Separates Backend = eigenes Repo oder
   Monorepo-Konfiguration, eigenes CI, diensteübergreifende Auth (Service-Token oder mTLS),
   CORS-Öffnung. Nichts davon löst ein Phase-0-Problem.
2. **Next.js Route Handler ist ausreichend.** Läuft serverseitig; verbindet sich über den
   `supabase-js`-Server-Client mit Supabase; Env-Secrets sind sicher; Middleware erzwingt Auth.
3. **Vercel — ein einziges Deploy.** Frontend + API auf einer Plattform; Cold-Start-Problematik
   besteht auch bei Route Handlern, ein separater Dienst löst das nicht.
4. **Risiko vorzeitiger Optimierung.** Die risikoreichste Annahme von Phase 0 ist
   verhaltensbasiert, nicht technisch (laden Gäste hoch?). Backend-Architektur testet diese
   Hypothese nicht.

**Trade-off:** Route Handler eignen sich nicht für langfristige Hintergrundarbeit (Video-
Transcoding, Massen-Benachrichtigungen). Diese Workloads sind für Phase 0 nicht im Umfang.
Bei Bedarf in Phase 2 werden Supabase Edge Functions oder ein separater Worker evaluiert;
die Entscheidung fällt dann.

---

## 5. ADR-002 — Warum Supabase Storage?

**Entscheidung:** Supabase Storage wird als Media-Storage verwendet. Kein separater
Object-Storage-Anbieter (R2, S3, Vercel Blob) wird gewählt.

**Kontext:**

- Supabase wurde bereits für Auth + Postgres + RLS ausgewählt.
- Supabase Storage ist ein S3-kompatibler Object Storage und unterstützt das
  Presigned-Upload-URL-Muster.

**Begründung:**

1. **Eine Plattform, ein Auth-Kontext.** Supabase-Storage-Bucket-Policies verwenden denselben
   `auth.uid()` und JWT. Der Gast lädt mit anonymem JWT hoch, der Tenant löscht mit Tenant-JWT —
   keine separate Storage-Auth-Schicht erforderlich. Bei einem anderen Anbieter (R2/S3) wäre
   ein eigener Signed-URL-Mechanismus und eine eigene Secret-Verwaltung nötig.
2. **Operationelle Einfachheit.** Ein Dashboard, eine Rechnung, ein Monitoring. In Phase 0
   sollte der operative Aufwand minimiert werden; Produktvalidierung hat Vorrang.
3. **Presigned-Upload-Unterstützung.** Mit `createSignedUploadUrl()` lädt der Client direkt hoch;
   der Next.js-Server transferiert keine Binärdaten. Das Muster ist identisch mit R2/S3-Presigned-
   URLs; keine Abstraktion erforderlich.
4. **Ausreichende Skalierung für Phase 0.** Supabase-Storage-Free-Tier: 1 GB Speicher,
   2 GB Egress/Monat. Bei Pilot-Tour-Zahlen werden diese Limits nicht erreicht.

**Trade-offs und Risiken:**

- **Vendor-Lock-in:** Supabase Storage API ist S3-kompatibel, erzeugt aber eine Abhängigkeit
  vom Supabase SDK. Bei einer Migration bleibt die Spalte `media_url` als Pfad erhalten;
  Dateien können übertragen werden, Anwendungscode muss angepasst werden, aber es entsteht
  kein Datenverlust.
- **Egress-Kosten:** Im Pro-Plan ist Egress kostenpflichtig. Bei hohem Video-Traffic kann
  R2 (egress-frei) vorteilhafter sein. Dies wird in Phase 2 beobachtet.
- **CDN:** Supabase Storage bietet kein eigenes CDN (direkter S3-ähnlicher Zugriff); bei
  großem Maßstab für Vorschau/Thumbnail kann ein separates CDN erforderlich sein. In Phase 0
  kein Problem.

**Auslöser für Entscheidungsrevision:** Wenn monatlicher Egress > 50 GB oder Storage-Kosten
mehr als 30 % der Supabase-Gesamtrechnung übersteigen, wird eine R2-Migration geprüft.
