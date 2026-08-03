# CLAUDE.md — Projektregeln

## Produkt

QR-basiertes Guest-UGC- & Feedback-Tool für mehrere Branchen (Sektoren).
Beachhead: Tourismus (Touroperatoren / Reiseleiter). Weitere Sektoren: Immobilien,
Hochzeit/Event. Kein Sektor ist privilegiert oder Standard.

Ein Tenant = eine Kundenorganisation (Reiseagentur, Maklerbüro, Event-Veranstalter)
mit genau einem Sektor. Jeder Sektor enthält einen oder mehrere Kampagnentypen; der
Kampagnentyp bestimmt den Flow-Modus des Gäste-Ablaufs (`gallery` oder `feedback`):

- Tourismus → Tour (Galerie) · Hotel/Aufenthalt (Feedback)
- Immobilien → Immobilie (Galerie **oder** Feedback, vom Operator wählbar)
- Hochzeit/Event → Hochzeit/Event (Galerie)

Sektoren gehören dem **Betreiber** und werden als Code entwickelt: ein Ordner je Sektor
unter `lib/sectors/<id>/`, aggregiert von `lib/sectors/index.ts` (einzige Quelle der Wahrheit).
Kunden können keinen Sektor anlegen; der Betreiber **weist** den Sektor zu (`tenants.sector`),
der Kunde sieht ihn nur schreibgeschützt. Ein neuer Sektor = ein Ordner unter `lib/sectors/` +
Registry-Eintrag + CHECK-Wert in der Migration; kein Sonderfall-Code.

Vor jeder Arbeit: Spec-Dateien unter docs/ lesen.

## Stack

- Next.js (App Router) + TypeScript (strict)
- API = Next.js Route Handler (kein separates Backend — wird in Phase 2 neu bewertet)
- Supabase — Postgres + RLS + Supabase Auth + Supabase Storage
- Deploy: Vercel

## Absolute Regeln

- `any` VERBOTEN. Bei Unklarheit `unknown` + Narrowing verwenden.
- Jede API-Route hat Zod-Validierung. Handler ohne Validierung werden nicht gemergt.
- Tenant-Isolierung wird über RLS durchgesetzt. RLS ist auf jeder Tabelle aktiv; Tabellen ohne Policy sind nicht erreichbar. Das ist Sicherheit, keine Option.
- Secrets nur in Umgebungsvariablen. Keine Secrets im Repository. .env.example bleibt aktuell.
- Gästemedien = personenbezogene Daten. Kein Feature gilt als „fertig" ohne Consent + Moderations-Flag + Löschpfad.
- Kein Sektor ist Standard; Sektoren gehören dem Betreiber. Sektor / Kampagnentyp / Flow-Modus werden aus `lib/sectors/` abgeleitet (ein Ordner je Sektor + Registry `index.ts`); ein neuer Sektor wird dort ergänzt (plus CHECK-Wert in der Migration), nicht über Sonderfälle im Code. Den Sektor eines Kunden weist der Betreiber zu (`tenants.sector`); Kunden können keinen Sektor anlegen oder ändern.
- „Fertig" = funktioniert + Input-Validierung + Fehlerfälle behandelt + mindestens 1 Test + deploybar.

## Arbeitsstil

- Erst PLAN vorlegen, Freigabe abwarten, DANN Code schreiben. Nie die gesamte Anwendung auf einmal.
- Kleine vertikale Scheiben: UI → API → DB → zurück. Ein Ablauf komplett von Ende zu Ende.
- Phase-0-„NICHT"-Liste nicht versehentlich berühren.

## Verzeichnisstruktur

```
app/              # Next.js App Router — Seiten und API-Routen
lib/sectors/      # Sektor-Module (ein Ordner je Sektor) + Registry (index.ts) — Kampagnentypen, Flow-Modi
lib/supabase/     # Drei Supabase-Clients (browser / server / admin)
types/            # database.ts — wird mit supabase gen types erzeugt, nicht manuell bearbeiten
supabase/         # supabase-init-Ausgabe; migrations/ und seed.sql
docs/             # Spec-, Architektur- und Anforderungsdokumente
tests/            # Testdateien (werden am Ende von Phase 0 hinzugefügt)
```

## Supabase-Client-Auswahl

| Client  | Datei                     | Schlüssel    | RLS         | Wo einsetzen                                  |
| ------- | ------------------------- | ------------ | ----------- | --------------------------------------------- |
| Browser | `lib/supabase/browser.ts` | anon         | ✅ Aktiv    | `"use client"`-Komponenten                    |
| Server  | `lib/supabase/server.ts`  | anon         | ✅ Aktiv    | Server-Komponente, Action, Route-Handler      |
| Admin   | `lib/supabase/admin.ts`   | service_role | ❌ Umgangen | Nur für zwingend notwendige privilegierte Ops |

Admin-Client niemals in eine Datei mit `"use client"` importieren.

## Befehle

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver
npm run dev

# Produktions-Build
npm run build

# Produktionsserver
npm start

# Lint
npm run lint

# Typprüfung
npm run typecheck

# Code formatieren
npm run format

# Formatprüfung (im CI verwendet)
npm run format:check

# Supabase-Typgenerierung (nach Migration ausführen)
npx supabase gen types typescript --local > types/database.ts
```

## Einrichtung für neue Entwickler

1. `cp .env.example .env.local` — Supabase-Projektwerte eintragen
2. `npm install`
3. `npx supabase start` — lokalen Supabase-Stack starten (Docker erforderlich)
4. `npx supabase db reset` — Migrationen anwenden + Seed
5. `npx supabase gen types typescript --local > types/database.ts`
6. `npm run dev`
