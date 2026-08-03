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

**Zwei-Schichten-Zugriffsmodell (GRANT + RLS):** Zugriff auf eine Tabelle erfordert
**beides** — eine Tabellen-Berechtigung (`GRANT`) für die API-Rolle (`anon`, `authenticated`,
`service_role`) **und** eine erfüllte RLS-Policy für die Zeile. Die GRANTs erteilt
**Migration `0007_grants.sql`** (inkl. `alter default privileges`, damit künftige Migrations-
Tabellen automatisch berechtigt sind). Fehlen die GRANTs, scheitert bereits der PostgREST-
Rollenwechsel mit `42501 permission denied` — noch bevor RLS greift. `service_role` (Admin-
Client) besitzt zusätzlich `BYPASSRLS`; das umgeht die **Policies**, nicht aber die **GRANTs**.

---

### Tabelle: `tenants`

```sql
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,        -- Unternehmensname
  brand_name  text not null,        -- Markenname, der auf der Gästeseite angezeigt wird
  sector      text not null         -- Branche: 'tourism' | 'real_estate' | 'event'
              check (sector in ('tourism', 'real_estate', 'event')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tenants_user_id_key unique (user_id)
);
```

**Beziehung:** `auth.users` ↔ `tenants` → 1:1. Jeder Unternehmensbenutzer in Supabase Auth
entspricht einer Zeile in dieser Tabelle.

**Sektor:** Jede Kundenorganisation gehört zu genau einem Sektor. Es gibt **keinen Default** —
der Sektor wird beim Onboarding gesetzt (Bestandszeilen wurden in der Multi-Sektor-Migration
einmalig auf `tourism` backfillt). Die zulässigen Sektoren und ihre Kampagnentypen sind in
`lib/sectors/` definiert (ein Ordner je Sektor + Registry; siehe Abschnitt 1.4).

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
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  date          date not null,
  description   text,
  campaign_type text not null        -- 'tour' | 'stay' | 'property' | 'wedding'
                check (campaign_type in ('tour', 'stay', 'property', 'wedding')),
  flow_mode     text not null        -- 'gallery' | 'feedback' | 'guestbook' (aus dem Kampagnentyp abgeleitet)
                check (flow_mode in ('gallery', 'feedback', 'guestbook')),
  archived_at   timestamptz,         -- aktive Kampagne = archived_at is null
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

**Kampagnentyp & Flow-Modus:** Jede Kampagne (`event`) hat einen `campaign_type`, der zum
Sektor des Tenants passen muss, und einen daraus abgeleiteten `flow_mode`. Der Server setzt
`flow_mode` über `resolveFlowMode()` aus der Registry; nur der Typ `property` (Immobilien)
erlaubt dem Operator, zwischen `gallery` und `feedback` zu wählen. Der Typ `wedding` (Event)
nutzt den privaten `guestbook`-Modus (Name + Glückwunsch + optionale Medien, nur für den
Veranstalter/das Brautpaar sichtbar). Bestandszeilen wurden auf `tour` / `gallery` backfillt.

> **Status (Retrenchment 0006 + Öffnung 0009):** Die oben gezeigten CHECK-Listen sind der
> **designed-for**-Zielzustand. **Aktiv** sind `tourism / tour / gallery` UND `tourism / stay /
feedback`: `0006_lockdown_tourism_gallery.sql` verengte die drei CHECKs zunächst auf je einen
> Wert; `0009_reopen_tourism_stay_feedback.sql` erweiterte `campaign_type` auf `('tour', 'stay')`
> und `flow_mode` auf `('gallery', 'feedback')` (Sektor bleibt `tourism`) und ergänzte ATOMAR das
> B1-Gallery-Audit — `public_gallery_select` bekommt `is_gallery_event`, damit private
> Feedback-Kommentare nie an andere Gäste gelangen. `0010` fügte die ownership-geprüfte RPC
> `attach_feedback` hinzu (rating/comment an einen Medien-Beitrag). Weiterhin gesperrt: der Modus
> `guestbook` sowie die Sektoren `real_estate`/`event`. (Wieder-)Aktivierung:
> **`docs/extension-points.md`**.

**Indizes:**

```sql
create index events_tenant_created_idx on events (tenant_id, created_at desc);
create index events_id_tenant_idx      on events (id, tenant_id);

-- Zählung aktiver Kampagnen je Tenant
create index events_tenant_active_idx
  on events (tenant_id) where archived_at is null;
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
  file_type        text,            -- 'image' | 'video'; NULL bei Feedback ohne Medien
  consent_at       timestamptz not null,
  uploaded_at      timestamptz,     -- gesetzt nach Upload-Bestätigung bzw. bei Feedback-Abgabe
  moderation_flag  boolean not null default false,
  rating           smallint check (rating between 1 and 5),
  comment          text,            -- Freitext-Feedback (Feedback-Modus)
  deleted_at       timestamptz,     -- Soft Delete
  created_at       timestamptz not null default now()
);
```

**Feedback vs. UGC:** Eine `submission` trägt sowohl UGC (Medien) als auch Feedback
(`rating`, `comment`). Im `gallery`-Modus ist ein Medium Pflicht (`file_type` gesetzt); im
`feedback`-Modus ist das Medium optional, dann bleibt `file_type` NULL, und `uploaded_at`
markiert die Feedback-Abgabe als abgeschlossen.

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

-- Galerie: sichtbar erst nach eigenem Upload (Reziprozitätssperre in RLS, Migration 0002).
-- has_completed_upload() ist security definer und bricht die RLS-Rekursion.
create policy "public_gallery_select"
  on submissions for select
  using (
    moderation_flag = false
    and deleted_at is null
    and uploaded_at is not null
    and public.has_completed_upload(event_id)
  );
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

### 1.4 Sektoren, Kampagnentypen & Flow-Modi (Registry)

Die Multi-Sektor-Fähigkeit ist **config-getrieben** und **Betreiber-eigen**. Sektoren werden
als Code entwickelt: je Sektor ein Ordner unter `lib/sectors/<id>/`, aggregiert von
`lib/sectors/index.ts` (einzige Quelle der Wahrheit; client- und serverseitig importierbar,
keine Secrets). So bleiben die Änderungen eines Sektors in seinem Ordner isoliert und über
`git diff` je Sektor nachvollziehbar. Die DB-Spalten `sector`, `campaign_type`, `flow_mode`
sind bewusst `text` + `CHECK` (statt Postgres-`enum`), damit ein neuer Sektor ohne `ALTER TYPE`
auskommt — nur die CHECK-Liste und ein Registry-Eintrag ändern sich. Den Sektor eines Kunden
weist der Betreiber zu (`tenants.sector`); Kunden können keinen Sektor anlegen.

**Modell:** Tenant → Sektor (1); Sektor → Kampagnentypen (1:N); Kampagnentyp → Default-Flow-Modus.

| Sektor        | Kampagnentypen | Flow-Modus                              |
| ------------- | -------------- | --------------------------------------- |
| `tourism`     | `tour`, `stay` | `gallery` (tour) · `feedback` (stay)    |
| `real_estate` | `property`     | `gallery` **oder** `feedback` (wählbar) |
| `event`       | `wedding`      | `guestbook`                             |

**Flow-Modus-Fähigkeiten** (`FLOW_MODE_CAPABILITIES`):

| Modus       | mediaRequired | gallery | reciprocity | rating | comment | guestName |
| ----------- | ------------- | ------- | ----------- | ------ | ------- | --------- |
| `gallery`   | ✅            | ✅      | ✅          | ✅     | ❌      | ❌        |
| `feedback`  | ❌            | ❌      | ❌          | ✅     | ✅      | ❌        |
| `guestbook` | ❌            | ❌      | ❌          | ❌     | ✅      | ✅        |

Registry-Helfer (Auszug): `campaignTypesForSector`, `isValidCampaignForSector`,
`resolveFlowMode`, `getCapabilities`, `resolveLabels` sowie die Narrowing-Guards
`isSector` / `isCampaignType` / `isFlowMode` (die `text`-Spalten kommen als `string` zurück).

**RLS-Hinweis:** Die neuen Spalten führen **keine neuen Policies** ein. `sector` liegt in der
`tenants`-Zeile des Benutzers (bestehende Tenant-Policies); `campaign_type` / `flow_mode` /
`archived_at` / `comment` liegen in `events` bzw. `submissions` und sind durch die vorhandene
Tenant-Isolierung (`current_tenant_id()`) bereits abgedeckt. Die Tenant-Sektor-Zuordnung wird
über die bestehende `tenant_update_own`-Policy geändert.

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

- **Voraussetzung:** Anonyme Anmeldungen müssen aktiviert sein — lokal via `supabase/config.toml`
  (`enable_anonymous_sign_ins = true`), in der Cloud via Dashboard (Authentication → Sign In /
  Providers → Anonymous). Ohne diese Einstellung schlägt der gesamte Gäste-Flow fehl.
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

### Feedback-Ablauf (`feedback`-Modus)

Kampagnen im `feedback`-Modus (Hotel-Aufenthalt, Immobilien-Besichtigung) benötigen kein
Medium. Endpunkt: `POST /api/events/[eventId]/feedback` (Gast-Session via `requireAnyAuth`,
`feedbackSchema`: mindestens Bewertung **oder** Kommentar).

- **Ohne Medium:** Der Endpunkt legt direkt eine `submission` an (`file_type` NULL,
  `consent_at` + `uploaded_at` serverseitig gesetzt, `rating` / `comment`).
- **Mit Medium:** Zuerst der normale Presigned-Upload (`presign` → PUT → `confirm`); danach
  hängt derselbe Endpunkt `rating` / `comment` per `submissionId` an die bestehende `submission`.

Keine Galerie, keine Reziprozitätssperre. Das Dashboard zeigt für diese Kampagnen eine
Feedback-Liste (Bewertung + Kommentar) statt eines Medienrasters.

### Gästebuch-Ablauf (`guestbook`-Modus)

Kampagnen im `guestbook`-Modus (Hochzeit, Marke **Momento**) sammeln **Name + Glückwunsch +
optionale Medien**, sichtbar **nur für den Veranstalter (Brautpaar)** — keine geteilte Galerie,
keine Reziprozität, kein Rating. Ein `submission`-Datensatz trägt zusätzlich `guest_name`.

- **Mit Medien:** normaler Presigned-Upload (`presign` → PUT → `confirm`); `guestName` +
  `message` werden bereits beim `presign` an den Medienbeitrag geschrieben (je Datei ein Datensatz).
- **Reiner Glückwunsch (ohne Medien):** `POST /api/events/[eventId]/guestbook`
  (`guestbookMessageSchema`: `guestName` + `message` + `consent`), legt einen abgeschlossenen,
  medienlosen Beitrag an.

Consent wird serverseitig erzwungen (`consent: z.literal(true)` in `presignSchema` /
`guestbookMessageSchema`). Das Dashboard zeigt eine private Gästebuch-Liste (Name + Text +
optionales Medium) mit Sperren/Löschen. Geteilte Galerie / Live-Fotowand folgt später als
`gallery`-Modus.

### Tarife (Basis, ohne Zahlung)

Tarife sind als Code-Registry gepflegt (`lib/plans/`, analog zu `lib/sectors/`): `free` / `pro`
mit Kontingenten (aktive Kampagnen, Uploads je Kampagne). Der Tarif steht in `tenants.plan`
(Default `free`, CHECK `free|pro`). Durchsetzung bei der Kampagnenerstellung (aktive Kampagnen)
und im `presign` (abgeschlossene Uploads je Event → 403 bei Überschreitung). Tatsächliche
Bezahlung (Stripe) ist bewusst ausgelagert.

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
