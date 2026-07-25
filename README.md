# GuestMatrix

QR-basiertes Gast-UGC- und Feedback-Tool für kleine Touroperatoren und Reiseleiter.

Gäste scannen einen QR-Code, laden Fotos und Videos hoch und bewerten die Veranstaltung — ohne App-Installation und ohne eigenen Account. Reiseleiter verwalten Events, moderieren Inhalte und laden QR-Codes herunter.

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

### Tenant (Reiseleiter / Operator)

- Anmeldung per E-Mail und Passwort
- Event erstellen (Name, Datum, Beschreibung)
- QR-Code pro Event als PNG herunterladen
- Mediengalerie im Dashboard: Thumbnail-Raster mit Moderationsstatus
- Inhalte sperren / freigeben (Moderations-Flag)
- Inhalte löschen (DSGVO-konform: Soft Delete + Storage-Löschung)
- KPI-Übersicht: Anzahl Uploads, Durchschnittsbewertung pro Event

### Gast (anonym, kein Account erforderlich)

- QR-Code scannen → Veranstaltungsseite
- DSGVO-Einwilligung bestätigen (Consent-Checkbox)
- Foto oder Video hochladen (JPEG, PNG, MP4, MOV · max. 100 MB) mit Fortschrittsanzeige
- Galerie aller genehmigten Inhalte einsehen (erst nach eigenem Upload — Reziprozitätssperre)
- Veranstaltung mit 1–5 Sternen bewerten
- Eigene Inhalte jederzeit löschen (DSGVO-Recht auf Vergessenwerden)

---

## Architektur

```
Browser / Mobil
      │
      ▼
Next.js 15 (Vercel)
  ├── App Router — Server Components (Standard)
  ├── Route Handler — API-Endpunkte (app/api/)
  ├── Server Actions — Formulare (Login, Event erstellen, Moderation)
  └── Client Components — Interaktive UI (GuestFlow, QrSection)
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
tenants  (id, user_id, name, brand_name)
    │ 1:N
    ▼
events   (id, tenant_id, name, date, description)
    │ 1:N
    ▼
submissions  (id, tenant_id, event_id, guest_user_id,
              media_url, file_type, consent_at,
              uploaded_at, moderation_flag, rating, deleted_at)
```

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
│   │   ├── route.ts                  # GET Liste · POST Erstellen
│   │   └── [eventId]/
│   │       ├── public/route.ts       # Öffentliche Event-Info (für Gäste)
│   │       ├── gallery/route.ts      # Galerie (Reziprozitätssperre)
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
│   ├── page.tsx                      # KPI-Übersicht + Event-Liste
│   └── events/
│       ├── new/                      # Event erstellen
│       └── [eventId]/                # Event-Detail: Mediengrid + QR + Moderation
├── e/[eventId]/                      # Gäste-Flow (mehrstufig)
├── login/                            # Tenant-Anmeldung
├── forgot-password/                  # Passwort zurücksetzen (E-Mail)
└── reset-password/                   # Neues Passwort setzen (PKCE)

lib/
├── auth/
│   ├── session.ts      # requireTenantAuth · requireAnyAuth · requireEventOwnership
│   └── errors.ts       # AppError-Hierarchie · handleRouteError
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
├── schemas.test.ts     # Zod-Schema-Tests
└── mime.test.ts        # Magic-Byte-Validierungstests
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
| `GET` | `/api/events/[eventId]/public` | Event-Name, Beschreibung, Markenname |
| `POST` | `/api/sessions` | Anonyme Gast-Session erstellen |
| `GET` | `/api/events/[eventId]/gallery` | Galerie (nur nach eigenem Upload) |
| `GET` | `/api/health` | Liveness-Check |

### Authentifiziert (Gast oder Tenant)

| Methode | Route | Beschreibung |
|---------|-------|--------------|
| `POST` | `/api/submissions/presign` | Presigned Upload-URL anfordern |
| `PATCH` | `/api/submissions/[id]/confirm` | Upload bestätigen + MIME prüfen |
| `PATCH` | `/api/submissions/[id]/rate` | Bewertung speichern (eigene Submission) |
| `DELETE` | `/api/submissions/[id]` | Submission löschen (DSGVO) |

### Nur Tenant (Dashboard)

| Methode | Route | Beschreibung |
|---------|-------|--------------|
| `GET` | `/api/events` | Alle eigenen Events auflisten |
| `POST` | `/api/events` | Neues Event erstellen |
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
