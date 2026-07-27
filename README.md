# GuestMatrix

QR-basiertes Gast-UGC- und Feedback-Tool für mehrere Branchen: Tourismus, Immobilien und Hochzeit/Event.

Gäste scannen einen QR-Code, teilen Fotos/Videos oder geben Feedback (Bewertung + Kommentar) — ohne App-Installation und ohne eigenen Account. Der Ablauf richtet sich nach dem Kampagnentyp: eine Galerie mit Reziprozitätssperre (Tour, Hochzeit) oder ein privates Feedback (Hotel-Aufenthalt, Immobilien-Besichtigung). Tenants verwalten Kampagnen, moderieren Inhalte und laden QR-Codes herunter.

Ein **Tenant** ist eine Kundenorganisation (z. B. eine Reiseagentur, ein Maklerbüro, ein Event-Veranstalter) mit genau einem **Sektor**. Kein Sektor ist Standard; neue Sektoren lassen sich über eine zentrale Registry ergänzen.

---

## Inhaltsverzeichnis

- [Tech-Stack](#tech-stack)
- [Funktionsübersicht](#funktionsübersicht)
- [Architektur](#architektur)
- [Verzeichnisstruktur](#verzeichnisstruktur)
- [Lokale Einrichtung](#lokale-einrichtung)
- [Befehle](#befehle)
- [API-Routen](#api-routen)
- [Sicherheit](#sicherheit)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Deployment](#deployment)

---

## Tech-Stack

| Schicht | Technologie |
|---------|-------------|
| Framework | Next.js 15 (App Router) |
| Sprache | TypeScript (strict) |
| Datenbank | Supabase Postgres + Row Level Security |
| Authentifizierung | Supabase Auth (E-Mail/Passwort für Tenants, anonym für Gäste) |
| Datei-Storage | Supabase Storage (privater Bucket, Presigned URLs) |
| Rate Limiting | Upstash Redis + `@upstash/ratelimit` |
| Validierung | Zod |
| QR-Code | `qrcode` |
| Tests | Vitest |
| Deployment | Vercel |

---

## Funktionsübersicht

### Tenant (Kundenorganisation)

- Anmeldung per E-Mail und Passwort
- Zugewiesene Branche (Sektor) unter **Einstellungen** einsehen (schreibgeschützt; wird vom Betreiber zugewiesen)
- Kampagne erstellen (Name, Datum, Beschreibung) mit sektorabhängigem **Kampagnentyp**; bei Immobilien zusätzlich **Galerie oder Feedback** wählbar
- QR-Code pro Kampagne als PNG herunterladen
- Galerie-Kampagnen: Thumbnail-Raster mit Moderationsstatus
- Feedback-Kampagnen: Liste aus Bewertung + Kommentar
- Inhalte sperren / freigeben (Moderations-Flag)
- Inhalte löschen (DSGVO-konform: Soft Delete + Storage-Löschung)
- Kampagnen archivieren / reaktivieren
- KPI-Übersicht: aktive Kampagnen, Beiträge gesamt, Durchschnittsbewertung

### Gast (anonym, kein Account erforderlich)

- QR-Code scannen → Kampagnenseite
- DSGVO-Einwilligung bestätigen (Consent-Checkbox)
- **Galerie-Ablauf** (Tour, Hochzeit): Foto/Video hochladen (JPEG, PNG, MP4, MOV · max. 50 MB) mit Fortschrittsanzeige, Galerie erst nach eigenem Upload (Reziprozitätssperre), 1–5-Sterne-Bewertung
- **Feedback-Ablauf** (Hotel-Aufenthalt, Immobilien-Besichtigung): Bewertung (1–5) und/oder Kommentar, Medien optional, keine öffentliche Galerie
- Eigene Beiträge jederzeit löschen (DSGVO-Recht auf Vergessenwerden)

---

## Sektoren & Kampagnentypen

Ein Tenant gehört zu genau einem Sektor. Jeder Sektor enthält einen oder mehrere Kampagnentypen; der Kampagnentyp legt den **Flow-Modus** des Gäste-Ablaufs fest. Sektoren gehören dem **Betreiber** und werden als Code entwickelt: je Sektor ein Ordner unter [`lib/sectors/`](lib/sectors), aggregiert von `lib/sectors/index.ts` (einzige Quelle der Wahrheit). Ein neuer Sektor = ein Ordner dort plus Registry-Eintrag und ein Wert in der CHECK-Liste der Migration. Den Sektor eines Kunden **weist der Betreiber zu** (`tenants.sector`); der Kunde sieht ihn nur schreibgeschützt und kann keinen Sektor anlegen.

| Sektor | Kampagnentyp | Flow-Modus |
|--------|--------------|------------|
| Tourismus (`tourism`) | Tour (`tour`) | `gallery` |
| Tourismus (`tourism`) | Hotel / Aufenthalt (`stay`) | `feedback` |
| Immobilien (`real_estate`) | Immobilie (`property`) | `gallery` **oder** `feedback` (wählbar) |
| Hochzeit / Event (`event`) | Hochzeit / Event (`wedding`) | `gallery` |

| Flow-Modus | Verhalten |
|------------|-----------|
| `gallery` | Medien-Pflicht · öffentliche Galerie · Reziprozitätssperre · Bewertung |
| `feedback` | Medien optional · keine Galerie/Reziprozität · Bewertung + Kommentar (privat) |

---

## Architektur

```
Browser / Mobil
      │
      ▼
Next.js 15 (Vercel)
  ├── App Router — Server Components (Standard)
  ├── Route Handler — API-Endpunkte (app/api/)
  ├── Server Actions — Formulare (Login, Kampagne erstellen, Sektor, Moderation, Archivieren)
  └── Client Components — Interaktive UI (GalleryFlow, FeedbackFlow, QrSection)
      │
      ├── Supabase Postgres (RLS auf jeder Tabelle)
      ├── Supabase Auth (Tenant: Email/PW · Gast: anonym)
      └── Supabase Storage (ugc-media, privater Bucket)
```

### Datenmodell

```
auth.users (Supabase Auth)
    │ 1:1
    ▼
tenants  (id, user_id, name, brand_name, sector)
    │ 1:N
    ▼
events   (id, tenant_id, name, date, description,
          campaign_type, flow_mode, archived_at)
    │ 1:N
    ▼
submissions  (id, tenant_id, event_id, guest_user_id,
              media_url, file_type, consent_at, uploaded_at,
              moderation_flag, rating, comment, deleted_at)
```

- `tenants.sector` — Sektor der Kundenorganisation (`tourism` · `real_estate` · `event`); ohne Default, beim Onboarding gesetzt.
- `events.campaign_type` / `flow_mode` — Kampagnentyp und daraus abgeleiteter Gäste-Ablauf.
- `events.archived_at` — aktive Kampagne = `archived_at is null`.
- `submissions.comment` — Freitext-Feedback; `file_type` ist optional (Feedback ohne Medien).

### Upload-Ablauf (3 Schritte)

```
Client              Next.js API           Supabase Storage
  │                      │                      │
  │── POST /presign ─────▶│                      │
  │◀── { presignedUrl,    │── createSignedUrl ───▶│
  │     submissionId } ───│◀──────────────────────│
  │                      │                      │
  │── PUT <presignedUrl> ──────────────────────────▶│
  │◀── 200 OK ─────────────────────────────────────│
  │                      │                      │
  │── PATCH /confirm ────▶│                      │
  │                      │── Magic-Byte-Check ───▶│
  │                      │── submissions UPDATE  │
  │◀── { ok: true } ─────│                      │
```

### Supabase-Clients

| Client | Datei | Schlüssel | RLS | Verwendung |
|--------|-------|-----------|-----|------------|
| Browser | `lib/supabase/browser.ts` | anon | ✅ aktiv | Client Components |
| Server | `lib/supabase/server.ts` | anon | ✅ aktiv | Server Components, Actions, Route Handler |
| Admin | `lib/supabase/admin.ts` | service_role | ❌ umgangen | Privilegierte Operationen (nur server-seitig) |

---

## Verzeichnisstruktur

```
app/
├── api/
│   ├── auth/logout/route.ts          # Abmelden
│   ├── events/
│   │   ├── route.ts                  # GET Liste · POST Erstellen (mit Kampagnentyp/Flow-Modus)
│   │   └── [eventId]/
│   │       ├── public/route.ts       # Öffentliche Kampagnen-Info + Flow-Modus + Labels
│   │       ├── gallery/route.ts      # Galerie (Reziprozitätssperre)
│   │       ├── feedback/route.ts     # Feedback (Bewertung + Kommentar, Medien optional)
│   │       └── submissions/route.ts  # Dashboard-Submissions mit signierten URLs
│   ├── sessions/route.ts             # Anonyme Gast-Session erstellen
│   ├── submissions/
│   │   ├── presign/route.ts          # Presigned Upload-URL
│   │   └── [submissionId]/
│   │       ├── confirm/route.ts      # Upload bestätigen + MIME prüfen
│   │       ├── moderate/route.ts     # Moderations-Flag setzen
│   │       ├── rate/route.ts         # Bewertung speichern
│   │       └── route.ts              # DELETE (Soft Delete + Storage)
│   └── health/route.ts              # Liveness-Check
├── dashboard/
│   ├── layout.tsx                    # Sidebar-Navigation
│   ├── page.tsx                      # KPI-Übersicht (aktive Kampagnen) + Kampagnen-Liste
│   ├── actions.ts                    # Kampagne archivieren / reaktivieren
│   ├── settings/                     # Zugewiesene Branche einsehen (schreibgeschützt)
│   └── events/
│       ├── new/                      # Kampagne erstellen (Typ + ggf. Flow-Modus)
│       └── [eventId]/                # Kampagnen-Detail: Mediengrid oder Feedback-Liste + QR
├── e/[eventId]/                      # Gäste-Flow — GuestFlow (Dispatcher),
│                                     #   GalleryFlow, FeedbackFlow, GuestShell
├── login/                            # Tenant-Anmeldung
├── forgot-password/                  # Passwort zurücksetzen (E-Mail)
└── reset-password/                   # Neues Passwort setzen (PKCE)

lib/
├── auth/
│   ├── session.ts      # requireTenantAuth · requireAnyAuth · requireEventOwnership
│   └── errors.ts       # AppError-Hierarchie · handleRouteError
├── sectors/            # Ein Ordner je Sektor (Betreiber-eigene Code-Module) + Registry
│   ├── types.ts        # Vertrag: Typen, Tupel, Flow-Modus-Konstanten
│   ├── index.ts        # Registry: aggregiert die Sektor-Module + Helfer
│   ├── tourism/        # Sektor-Modul (tour, stay)
│   ├── real_estate/    # Sektor-Modul (property)
│   └── event/          # Sektor-Modul (wedding)
├── supabase/
│   ├── browser.ts      # Browser-Client (Client Components)
│   ├── server.ts       # Server-Client (SSR + Cookies)
│   └── admin.ts        # Admin-Client (service_role, server-only)
├── storage/
│   ├── mime.ts         # MIME-Validierung via Magic Bytes
│   └── signed-url.ts   # createSignedUrl · createSignedUrls
├── validation/
│   └── schemas.ts      # Alle Zod-Schemas (single source of truth)
├── rate-limit.ts       # Upstash-Rate-Limiter (fail-open)
└── logger.ts           # Strukturiertes Logging (JSON in Prod)

supabase/
├── migrations/         # SQL-Migrationen (Tabellen + RLS + Indizes)
└── seed.sql

types/
└── database.ts         # Generierte Supabase-Typen (nicht manuell bearbeiten)

tests/
├── schemas.test.ts        # Zod-Schema-Tests
├── campaign-config.test.ts # Sektor-/Kampagnen-Registry-Tests
└── mime.test.ts           # Magic-Byte-Validierungstests
```

---

## Lokale Einrichtung

**Voraussetzungen:** Node.js ≥ 20, Docker (für lokalen Supabase-Stack)

```bash
# 1. Repository klonen
git clone <repo-url>
cd guestmatrix

# 2. Umgebungsvariablen einrichten
cp .env.example .env.local
# .env.local mit den Supabase-Projektwerten befüllen

# 3. Abhängigkeiten installieren
npm install

# 4. Lokalen Supabase-Stack starten
npx supabase start

# 5. Migrationen anwenden + Seed-Daten laden
npx supabase db reset

# 6. TypeScript-Typen aus dem Datenbankschema generieren
npx supabase gen types typescript --local > types/database.ts

# 7. Entwicklungsserver starten
npm run dev
```

Die App ist anschließend unter `http://localhost:3000` erreichbar.

Supabase Studio (lokales Dashboard): `http://localhost:54323`

---

## Befehle

```bash
npm run dev          # Entwicklungsserver starten
npm run build        # Produktions-Build erstellen
npm start            # Produktionsserver starten
npm run lint         # ESLint ausführen
npm run lint:fix     # ESLint-Fehler automatisch beheben
npm run typecheck    # TypeScript-Typprüfung (tsc --noEmit)
npm run format       # Prettier (Formatierung anwenden)
npm run format:check # Prettier (nur prüfen, kein Schreiben — für CI)
npm test             # Vitest (alle Tests ausführen)
```

---

## API-Routen

Alle Routen geben `{ error: string }` mit dem passenden HTTP-Statuscode zurück. Kein Stack-Trace wird an den Client gesendet.

### Öffentlich

| Methode | Route | Beschreibung |
|---------|-------|--------------|
| `GET` | `/api/events/[eventId]/public` | Name, Beschreibung, Markenname, Kampagnentyp, Flow-Modus, Labels |
| `POST` | `/api/sessions` | Anonyme Gast-Session erstellen |
| `GET` | `/api/events/[eventId]/gallery` | Galerie (nur nach eigenem Upload) |
| `GET` | `/api/health` | Liveness-Check |

### Authentifiziert (Gast oder Tenant)

| Methode | Route | Beschreibung |
|---------|-------|--------------|
| `POST` | `/api/submissions/presign` | Presigned Upload-URL anfordern |
| `PATCH` | `/api/submissions/[id]/confirm` | Upload bestätigen + MIME prüfen |
| `PATCH` | `/api/submissions/[id]/rate` | Bewertung speichern (eigene Submission) |
| `POST` | `/api/events/[eventId]/feedback` | Feedback abgeben (Bewertung + Kommentar, Medien optional) |
| `DELETE` | `/api/submissions/[id]` | Submission löschen (DSGVO) |

### Nur Tenant (Dashboard)

| Methode | Route | Beschreibung |
|---------|-------|--------------|
| `GET` | `/api/events` | Alle eigenen Kampagnen auflisten |
| `POST` | `/api/events` | Neue Kampagne erstellen (Kampagnentyp + Flow-Modus) |
| `GET` | `/api/events/[eventId]/submissions` | Submissions mit signierten URLs |
| `PATCH` | `/api/submissions/[id]/moderate` | Moderations-Flag setzen / aufheben |
| `POST` | `/api/auth/logout` | Abmelden |

---

## Sicherheit

Eine vollständige Analyse aller 18 STRIDE-Bedrohungen und der implementierten Gegenmaßnahmen ist in [`docs/security-report.md`](docs/security-report.md) dokumentiert.

### Überblick

| Bereich | Maßnahme |
|---------|----------|
| Session-Token | Ausschließlich `httpOnly`-Cookies — kein `localStorage` |
| Passwort-Hashing | Argon2 (Supabase Auth intern) |
| Idle-Timeout | 30 Minuten für Tenant-Sessions |
| Tenant-Isolierung | Row Level Security auf allen Tabellen (Datenbankebene) |
| Input-Validierung | Zod auf jedem API-Endpunkt |
| Rate Limiting | Upstash Redis (Login, Reset, Upload, Galerie, allgemein) |
| MIME-Validierung | Magic Bytes (erste 12 Bytes) — nicht Content-Type-Header |
| Storage-Pfade | Vollständig server-seitig generiert — kein Client-Input im Pfad |
| Download-URLs | Signierte URLs mit Ablaufzeit — keine rohen Storage-Pfade |
| Security Headers | CSP, HSTS, X-Frame-Options, COEP/COOP/CORP, Permissions-Policy |
| Fehlerantworten | Generische Meldungen — kein Stack-Trace, keine Server-Details |
| Secrets | Ausschließlich Umgebungsvariablen — kein Secret im Repository |
| DSGVO | Consent-Timestamp server-seitig, Soft Delete + Storage-Löschung |

---

## Umgebungsvariablen

Alle benötigten Variablen sind in `.env.example` dokumentiert.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=         # Projekt-URL (öffentlich)
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Anon-Key (öffentlich)
SUPABASE_SERVICE_ROLE_KEY=        # Service-Role-Key (nur server-seitig!)

# App
NEXT_PUBLIC_APP_URL=              # Öffentliche URL (z. B. https://app.example.de)

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=           # Nur server-seitig — kein NEXT_PUBLIC_!
UPSTASH_REDIS_REST_TOKEN=         # Nur server-seitig — kein NEXT_PUBLIC_!
```

> **Hinweis:** Variablen ohne `NEXT_PUBLIC_`-Präfix sind ausschließlich auf dem Server verfügbar und landen nie im Client-Bundle.

---

## Deployment

Das Projekt ist für Vercel optimiert.

```bash
# Vercel CLI
vercel deploy
```

**Checkliste vor dem ersten Deployment:**

- [ ] Supabase-Projekt erstellt, alle Migrationen angewendet
- [ ] Alle Umgebungsvariablen in Vercel eingetragen
- [ ] Upstash Redis-Instanz erstellt und Credentials hinterlegt
- [ ] `NEXT_PUBLIC_APP_URL` auf die Produktions-Domain gesetzt
- [ ] Supabase Auth: E-Mail-Vorlagen angepasst (Passwort-Reset-Link)
- [ ] Supabase Storage: Bucket `ugc-media` als privat konfiguriert

Nach jeder Datenbankänderung:

```bash
npx supabase gen types typescript --project-id <project-ref> > types/database.ts
```
