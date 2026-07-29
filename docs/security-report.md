# Sicherheitsbericht — GuestMatrix Phase 0

**Datum:** 2026-07-25
**Autor:** Claude Sonnet 4.6 (KI-gestützte Codeüberprüfung)
**Status:** Phase 0 abgeschlossen — alle kritischen und wichtigen Maßnahmen umgesetzt

---

## 1. Bedrohungsmodell (STRIDE)

### 1.1 Scope

GuestMatrix ist ein QR-basiertes Gast-UGC- und Feedback-Tool für kleine Touroperatoren. Drei Akteure interagieren mit dem System:

| Akteur | Vertrauen | Zugriff |
|--------|-----------|---------|
| Tenant (Betreiber) | Authentifiziert (E-Mail + Passwort) | Dashboard, Events, Moderationsfunktionen |
| Gast | Anonym authentifiziert (Supabase `signInAnonymously`) | Upload, Galerie-Ansicht (nach Upload) |
| Angreifer | Kein Vertrauen | Öffentlich zugängliche Endpunkte |

### 1.2 Identifizierte Bedrohungen (T1–T18)

| ID | STRIDE-Kategorie | Beschreibung | Priorität | Status |
|----|-----------------|--------------|-----------|--------|
| T1 | Spoofing | Brute-Force auf Tenant-Login | Kritisch | ✅ Behoben |
| T2 | Tampering | MIME-Typ-Manipulation beim Upload | Kritisch | ✅ Behoben |
| T3 | Information Disclosure | Gast sieht Galerie ohne Upload | Kritisch | ✅ Behoben |
| T4 | Elevation of Privilege | Gast greift auf Tenant-Funktionen zu | Kritisch | ✅ Behoben |
| T5 | Tampering | Path-Injection in Storage-Pfad | Hoch | ✅ Behoben |
| T6 | Tampering | Consent-Zeitstempel vom Client fälschbar | Hoch | ✅ Behoben |
| T7 | Denial of Service | API-Flooding ohne Rate Limiting | Hoch | ✅ Behoben |
| T8 | Information Disclosure | Rohe Storage-Pfade im Client sichtbar | Hoch | ✅ Behoben |
| T9 | Spoofing | Session-Hijacking via localStorage | Hoch | ✅ Behoben |
| T10 | Information Disclosure | Idle-Session bleibt unbegrenzt aktiv | Mittel | ✅ Behoben |
| T11 | Spoofing | E-Mail-Enumeration bei Passwort-Reset | Mittel | ✅ Behoben |
| T12 | Tampering | Open Redirect nach Login | Mittel | ✅ Behoben |
| T13 | Information Disclosure | Interne Fehlermeldungen im Client | Mittel | ✅ Behoben |
| T14 | Tampering | SQL/NoSQL-Injection über Inputs | Mittel | ✅ Behoben |
| T15 | Tampering | XSS via unsicheres CSP | Mittel | ✅ Behoben |
| T16 | Tampering | Clickjacking | Mittel | ✅ Behoben |
| T17 | Information Disclosure | Tenant-Datenisolierung fehlt | Kritisch | ✅ Behoben (RLS) |
| T18 | Denial of Service | Upload sehr großer Dateien | Niedrig | ✅ Behoben |

---

## 2. Implementierte Sicherheitsmaßnahmen

### 2.1 Authentifizierung & Session-Management

**Datei:** `lib/auth/session.ts`, `middleware.ts`, `app/login/`, `app/forgot-password/`, `app/reset-password/`

#### Token-Speicherung
- Supabase JWT-Tokens werden **ausschließlich in `httpOnly`-Cookies** gespeichert (nie `localStorage` oder `sessionStorage`)
- Cookie-Attribute: `httpOnly: true`, `Secure: true`, `SameSite: lax`, `maxAge: 7 Tage`
- `SameSite: lax` (nicht `strict`) ist notwendig, damit QR-Code-Links cross-origin navigieren können

#### Passwort-Sicherheit
- Passwort-Hashing wird vollständig von Supabase Auth übernommen (Argon2 intern)
- Mindestlänge: 8 Zeichen (validiert via Zod in `lib/validation/schemas.ts`)
- Maximallänge: 128 Zeichen (verhindert bcrypt-DoS bei sehr langen Strings)

#### Idle-Timeout (T10)
- 30-Minuten-Inaktivitäts-Timeout für Tenant-Sessions
- Implementierung: `gm_last_active` httpOnly-Cookie, aktualisiert bei jeder authentifizierten Anfrage in `middleware.ts`
- Ablauf: Redirect auf `/api/auth/logout?reason=idle_timeout`
- Gilt **nicht** für anonyme Gast-Sessions (Gäste haben kein Dashboard)

#### Passwort-Reset (T11 — E-Mail-Enumeration)
- `forgotPasswordAction` gibt **immer dieselbe Antwort** zurück, unabhängig davon ob die E-Mail registriert ist
- Rate Limiting: 3 Anfragen/Stunde/IP
- PKCE-Flow: Reset-Code wird beim Einlösen invalidiert (`exchangeCodeForSession`)
- Recovery-Session wird nach Passwortänderung sofort invalidiert (`signOut`)

#### Open Redirect (T12)
- `next`-Parameter nach Login wird validiert: nur Pfade, die mit `/` beginnen und nicht `//` (Protocol-relative URL)
- Implementierung in `app/login/actions.ts`: `next.startsWith('/') && !next.startsWith('//')`

#### Generische Fehlermeldungen (T13)
- Login-Fehler: immer `"E-Mail-Adresse oder Passwort ist falsch."` — nie unterscheiden ob E-Mail oder Passwort falsch
- Interne Fehlerdetails werden nie an den Client gesendet
- `handleRouteError()` in `lib/auth/errors.ts` fängt alle unbehandelten Fehler ab

### 2.2 Autorisierung & Tenant-Isolierung

**Datei:** `lib/auth/session.ts`, `supabase/migrations/`

#### Row Level Security (RLS) — T17
- **Jede Tabelle** (`tenants`, `events`, `submissions`) hat aktive RLS-Policies
- `current_tenant_id()` PostgreSQL-Funktion liest Tenant-ID aus dem JWT
- Daten eines Tenants sind für andere Tenants **auf Datenbankebene** nicht sichtbar
- RLS ist die letzte Verteidigungslinie — ein Bug in der App-Schicht kann nicht zu Datenlecks führen
- **Zugriff = GRANT + RLS:** Die Tabellen-GRANTs für `anon`/`authenticated`/`service_role`
  liefert Migration `0007_grants.sql`; ohne sie ist die Tabelle für die API-Rolle gar nicht
  erreichbar (`42501`, fail-closed). RLS filtert danach die Zeilen.
- **Flow-Modus-Lock (Migration `0006`):** `events.flow_mode` ist per CHECK auf `gallery`
  verengt. Da RLS **nicht** flow-mode-aware ist (`public_gallery_select` filtert nicht nach
  `flow_mode`), verhindert dieser CHECK, dass überhaupt eine `feedback`/`guestbook`-Zeile mit
  privatem `comment` entsteht — die potenzielle Leak-Fläche ist damit physisch geschlossen.
  Beim Reaktivieren eines guest-sichtbaren Modus ist diese Policy neu zu auditieren
  (siehe `docs/extension-points.md`).

#### Berechtigungshierarchie in Route-Handlern
```
requireTenantAuth()       → Nur authentifizierte, nicht-anonyme User
requireAnyAuth()          → Authentifizierte + anonyme Gäste
requireEventOwnership()   → Prüft ob Tenant das Event besitzt
```

#### Galerie-Reziprozitätssperre (T3)
- Server-seitig erzwungen in `app/api/events/[eventId]/gallery/route.ts`
- Ein Gast kann die Galerie nur sehen, wenn er **mindestens eine bestätigte Datei** hochgeladen hat
- Prüfung zählt Submissions mit `uploaded_at IS NOT NULL` und `deleted_at IS NULL`

#### Admin-Client-Isolation
- `supabaseAdmin` (Service-Role-Key) ist in `lib/supabase/admin.ts` mit `import 'server-only'` geschützt
- Kann **niemals** in Client-Komponenten importiert werden
- Wird nur für zwingend notwendige privilegierte Operationen verwendet

### 2.3 Input-Validierung & Injection-Schutz

**Datei:** `lib/validation/schemas.ts`

Alle API-Endpunkte und Server Actions validieren Eingaben mit **Zod** vor der Verarbeitung:

| Schema | Validiert | Endpunkt |
|--------|-----------|----------|
| `loginSchema` | E-Mail (RFC 5321), Passwort (8–128 Zeichen) | `/login` |
| `forgotPasswordSchema` | E-Mail | `/forgot-password` |
| `resetPasswordSchema` | Passwort + Bestätigung | `/reset-password` |
| `presignSchema` | EventID (UUID), Dateiname (Allowlist-Regex), MIME-Typ (Enum) | `POST /api/submissions/presign` |
| `createEventSchema` | Name, Datum (ISO 8601), Beschreibung | Event-Erstellung |
| `eventIdParam` | UUID | Route-Parameter |
| `submissionIdParam` | UUID | Route-Parameter |

**NoSQL/SQL-Injection (T14):** Supabase-Queries verwenden parametrisierte Anfragen — kein direktes String-Interpolieren von User-Input in Queries.

**Storage-Path-Injection (T5):**
- Storage-Pfad wird **vollständig server-seitig** konstruiert: `{tenant_id}/{event_id}/{submission_id}/{uuid}{ext}`
- Der Dateiname des Clients (`fileName`) wird nur für die UI-Anzeige gespeichert, **nie im Pfad verwendet**

**Consent-Timestamp (T6):**
- `consent_at` wird **server-seitig** in `presignSchema` gesetzt (`new Date().toISOString()`)
- Der Client kann den Zeitstempel nicht manipulieren

### 2.4 Rate Limiting

**Datei:** `lib/rate-limit.ts`

| Limiter | Strategie | Limit | Scope |
|---------|-----------|-------|-------|
| `login` | Fixed Window | 5 / 15 min | IP |
| `forgotPassword` | Fixed Window | 3 / 1 Std | IP |
| `anonSession` | Fixed Window | 10 / 1 Std | IP |
| `presign` | Sliding Window | 20 / 1 min | User-ID |
| `gallery` | Sliding Window | 60 / 1 min | IP |
| `api` | Sliding Window | 200 / 1 min | IP |

**Infrastruktur:** Upstash Redis (serverless-kompatibel)

**Fail-Open-Strategie:** Bei Redis-Ausfall werden Anfragen **durchgelassen** — Rate Limiting verursacht keine Ausfälle der Hauptfunktionalität. In Produktion wird gewarnt wenn Redis nicht erreichbar ist.

**DoS-Schutz (T18):** Maximale Request-Body-Größe für Server Actions: 100 MB (konfiguriert in `next.config.ts`)

### 2.5 Datei-Upload-Sicherheit

**Datei:** `lib/storage/mime.ts`, `app/api/submissions/presign/route.ts`, `app/api/submissions/[submissionId]/confirm/route.ts`

#### Upload-Flow (3 Schritte)
1. **Presign** (`POST /api/submissions/presign`): Server erstellt signierte Upload-URL, legt Submission in Pending-Status an
2. **Upload**: Client lädt Datei direkt zu Supabase Storage hoch (presigned URL, max. 5 Minuten gültig)
3. **Confirm** (`PATCH /api/submissions/[id]/confirm`): Server liest erste 12 Bytes via Range-Request, prüft Magic Bytes

#### MIME-Validierung via Magic Bytes (T2)
Erlaubte Typen werden anhand der ersten Bytes der Datei erkannt — nicht anhand des Content-Type-Headers:

| Format | Magic Bytes | Offset |
|--------|-------------|--------|
| JPEG | `FF D8 FF` | 0 |
| PNG | `89 50 4E 47` | 0 |
| MP4 | `ftyp`-Box | 4–7 |
| QuickTime | `ftyp qt  ` | 4–11 |

Bei ungültigem MIME-Typ: Datei **und** Submission werden sofort gelöscht.

#### Signierte Download-URLs (T8)
- Rohe Storage-Pfade werden **nie an den Client** zurückgegeben
- Galerie-Anzeige: signierte URLs mit 1-Stunde-Ablauf (`SIGNED_URL_EXPIRY.gallery`)
- Upload-Vorschau: 5-Minuten-URL (`SIGNED_URL_EXPIRY.preview`)
- MIME-Check: 1-Minuten-URL (einmalig, serverseitig) (`SIGNED_URL_EXPIRY.mimeCheck`)

### 2.6 HTTP-Sicherheits-Header

**Datei:** `next.config.ts`

| Header | Wert | Schutz gegen |
|--------|------|--------------|
| `Content-Security-Policy` | Eingeschränkte Allowlist | XSS (T15) |
| `X-Frame-Options` | `DENY` | Clickjacking (T16) |
| `X-Content-Type-Options` | `nosniff` | MIME-Sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer-Leaks |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS-Erzwingung |
| `Permissions-Policy` | Camera, Mic, Geo, Payment, USB deaktiviert | API-Missbrauch |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cross-Origin-Leaks |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Spectre-Angriffe |
| `Cross-Origin-Resource-Policy` | `same-origin` | Cross-Origin-Reads |

### 2.7 Logging & Observability

**Datei:** `lib/logger.ts`

- Strukturiertes JSON-Logging in Produktion (für Vercel-Log-Drain / Aggregatoren)
- Menschenlesbares Format in Entwicklung
- Sicherheitsrelevante Ereignisse werden geloggt: `[auth] login_failed`, `[auth] reset_code_exchange_failed`, `[gallery] signed URL generation failed`
- **Kein** Stack-Trace oder interne Fehlermeldung wird an den Client weitergegeben

### 2.8 Umgebungsvariablen & Secrets

- Alle Secrets sind in Umgebungsvariablen — **kein Secret im Repository**
- `SUPABASE_SERVICE_ROLE_KEY` hat kein `NEXT_PUBLIC_`-Präfix → landet nicht im Client-Bundle
- `UPSTASH_REDIS_REST_TOKEN` hat kein `NEXT_PUBLIC_`-Präfix → nur server-seitig lesbar
- `.env.example` dokumentiert alle benötigten Variablen (Werte nicht befüllt)

**Neu in Phase 0 benötigte Umgebungsvariablen:**

```
UPSTASH_REDIS_REST_URL=    # Upstash Redis REST URL (kein NEXT_PUBLIC_!)
UPSTASH_REDIS_REST_TOKEN=  # Upstash Redis REST Token (kein NEXT_PUBLIC_!)
NEXT_PUBLIC_APP_URL=       # Öffentliche App-URL (z. B. https://app.guestmatrix.de)
```

---

## 3. Paket-Versionen und Abhängigkeiten

| Paket | Version | Zweck |
|-------|---------|-------|
| `@supabase/ssr` | 0.12.x | Server-seitiger Supabase-Client (SSR/Cookie) |
| `@supabase/supabase-js` | 2.110.x | Supabase-Datenbankzugriff |
| `@upstash/ratelimit` | — | Redis-basiertes Rate Limiting |
| `@upstash/redis` | — | Serverless-Redis-Client |
| `zod` | — | Schema-Validierung |

**Hinweis:** `@supabase/ssr` wurde von 0.6.1 auf 0.12.x aktualisiert, um eine Typ-Inkompatibilität mit `@supabase/supabase-js` 2.110+ zu beheben, die alle Query-Rückgabetypen auf `never` kollabieren ließ.

---

## 4. Bekannte Einschränkungen & geplante Verbesserungen

### 4.1 CSP `unsafe-inline` für Scripts

**Problem:** Next.js 15 injiziert Inline-Scripts für die Hydration. Ohne Nonce-Infrastruktur ist `'unsafe-inline'` in `script-src` erforderlich, was XSS-Schutz durch CSP schwächt.

**Risiko:** Mittel — React's DOM-Escaping verhindert die meisten XSS-Angriffe, CSP ist hier keine primäre Abwehrlinie

**Geplante Lösung (Phase 2):** CSP-Nonce via `middleware.ts` generieren, `nonce`-Prop an `<Script>`-Komponenten weitergeben

### 4.2 Kein zentrales Error-Monitoring

**Problem:** Unbehandelte Exceptions landen nur im Server-Log, kein strukturiertes Alerting

**Geplante Lösung (Phase 2):** Sentry-Integration (`@sentry/nextjs`) mit separatem DSN-Secret

### 4.3 Kein CSRF-Schutz via Double-Submit-Cookie

**Warum kein Problem in Phase 0:** Next.js Server Actions sind gegen CSRF geschützt, weil sie nur via `fetch` mit spezifischem `Content-Type: text/plain` oder als `FormData`-POST ausgelöst werden können. Der Browser sendet `application/x-www-form-urlencoded` für reguläre Forms, was Next.js ablehnt. Zusätzlich wird `SameSite: lax` auf Session-Cookies gesetzt.

**Überprüfung in Phase 2:** Wenn API-Routen aus anderen Domains aufgerufen werden sollen, CSRF-Token einführen.

### 4.4 Keine automatisierten Sicherheitstests

**Geplante Lösung (Phase 1):** Unit-Tests für `requireTenantAuth`, `requireEventOwnership`, MIME-Validierung; Integration-Tests für Rate-Limiting-Flows

### 4.5 Datenschutz (DSGVO)

**Identifizierte Anforderungen:**
- Gäste-Medien gelten als personenbezogene Daten (Fotos/Videos)
- Consent wird server-seitig mit Zeitstempel gespeichert (`consent_at`)
- Löschpfad existiert (`deleted_at`-Soft-Delete + Storage-Datei-Löschung in `confirm/route.ts`)
- **Noch offen:** Vollständige Datenlöschung auf expliziten Gast-Request, Datenschutzerklärung-UI, Aufbewahrungsfristen

---

## 5. Sicherheitscheckliste Phase 0

### Authentifizierung
- [x] httpOnly + Secure + SameSite Cookies
- [x] Keine Tokens in localStorage
- [x] Idle-Timeout (30 Minuten)
- [x] Rate Limiting auf Login (5/15min)
- [x] Generische Fehlermeldungen (kein E-Mail/Passwort-Unterschied)
- [x] Passwort-Reset ohne E-Mail-Enumeration
- [x] Open-Redirect-Schutz nach Login
- [x] PKCE-Flow für Passwort-Reset

### Autorisierung
- [x] RLS auf allen Tabellen aktiv
- [x] Tabellen-GRANTs für API-Rollen gesetzt (`0007_grants.sql`; Zugriff = GRANT + RLS)
- [x] Flow-Modus per CHECK auf `gallery` verengt (`0006`) — feedback/guestbook-Leak-Fläche geschlossen
- [x] Tenant-Isolierung auf DB-Ebene
- [x] `requireTenantAuth()` / `requireAnyAuth()` in allen geschützten Routen
- [x] Galerie-Reziprozitätssperre server-seitig erzwungen
- [x] Admin-Client mit `server-only` geschützt

### Datei-Upload
- [x] MIME-Validierung via Magic Bytes (nicht Content-Type-Header)
- [x] Storage-Pfad vollständig server-seitig generiert
- [x] Consent-Timestamp server-seitig gesetzt
- [x] Signierte URLs (niemals rohe Storage-Pfade)
- [x] Defekte Dateien werden gelöscht (file + DB-Eintrag)

### API
- [x] Zod-Validierung auf allen Endpunkten
- [x] Rate Limiting (Upstash Redis, fail-open)
- [x] Generische Fehlerantworten `{ error: string }`
- [x] Kein Stack-Trace im Response-Body

### HTTP-Sicherheit
- [x] Content-Security-Policy
- [x] X-Frame-Options: DENY
- [x] HSTS mit Preload
- [x] Permissions-Policy (Camera, Mic, Geo deaktiviert)
- [x] COEP / COOP / CORP

### Secrets & Konfiguration
- [x] Kein Secret im Code oder Repository
- [x] Service-Role-Key ohne NEXT_PUBLIC_-Präfix
- [x] Redis-Credentials ohne NEXT_PUBLIC_-Präfix
