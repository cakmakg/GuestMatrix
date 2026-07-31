# DSGVO-Löschung — Fehlerpfad-Nachweis (live)

Beweist **gegen echtes Storage** (nicht per Mock), dass der Fail-safe-Ablauf in
`lib/submissions/delete-submission.ts` hält, wenn die Storage-Löschung **wirklich** scheitert:

- Der Aufruf liefert **HTTP 500** (`StorageDeletionError`).
- `deleted_at` wird **NICHT** gesetzt (die Zeile gilt nicht als gelöscht).
- Die Datei bleibt **erhalten** (keine stille DSGVO-Diskrepanz zwischen DB und Bucket).

Ergänzt den Reihenfolge-Unit-Test (`tests/delete-submission.test.ts`, Mock) und den
Ownership-SQL-Nachweis (`supabase/tests/gdpr_delete_proof.sql`). Der **Happy-Path** (Datei weg +
`deleted_at` gesetzt + `media_url` genullt) ist bereits live bewiesen; hier geht es allein um den
**Fehlerpfad**.

## Prinzip

Ein echter Storage-Fehler wird deterministisch erzwungen, indem `remove()` gegen einen **nicht
existierenden Bucket** läuft → Supabase meldet „Bucket not found" (eine bereits fehlende _Datei_
meldet Supabase hingegen NICHT als Fehler, taugt also nicht zum Erzwingen). Das geschieht über
eine **temporäre, nicht committete** Änderung des Bucket-Namens — Produktionscode bleibt unberührt.

## Voraussetzungen

1. Lokaler Stack läuft: `npx supabase start` (Docker erforderlich).
2. Migrationen + Seed frisch: `npx supabase db reset` (wendet u. a. `0011` an).
   > `db reset` löscht lokale Daten — bewusst und nur lokal ausführen.
3. **Eine reale Einreichung mit hochgeladener Datei** in `ugc-media`: als Gast über die App
   (`/e/<eventId>`) einen echten Upload abschließen. Die `submissionId` und den `media_url`-Pfad
   notieren (Dashboard bzw. `select id, media_url from public.submissions ...`).

## Ablauf

1. **Vorzustand festhalten**
   - Storage (Studio → Storage → `ugc-media`): Zieldatei ist **vorhanden**.
   - DB: `select deleted_at, media_url from public.submissions where id = '<submissionId>';`
     → `deleted_at` ist **NULL**, `media_url` gesetzt.

2. **Storage-Löschung erzwingen** (temporär, NICHT committen)
   In `lib/submissions/delete-submission.ts` den Bucket-Namen auf einen nicht existierenden setzen:

   ```ts
   const BUCKET = 'ugc-media-__forced-fail__'
   ```

   Dev-Server neu starten, falls nötig (`npm run dev`).

3. **Als Eigentümer löschen**
   Mit der Session des Gastes, der die Datei hochgeladen hat (oder des besitzenden Tenants), die
   Löschung auslösen — über den Lösch-Button der App **oder**:

   ```bash
   curl -i -X DELETE http://localhost:3000/api/submissions/<submissionId> \
     -H 'Cookie: <deine-Session-Cookies>'
   ```

4. **Assertions**
   - **HTTP 500** mit Body `{"error":"Löschung fehlgeschlagen, bitte erneut versuchen."}`.
   - Server-Log enthält `[gdpr_delete] storage_remove_failed`.
   - DB: `select deleted_at, media_url from public.submissions where id = '<submissionId>';`
     → `deleted_at` weiterhin **NULL**, `media_url` weiterhin **gesetzt** (Fail-safe hielt).
   - Storage: Zieldatei ist **weiterhin vorhanden**.

5. **Zurücksetzen** (Pflicht)

   ```bash
   git checkout lib/submissions/delete-submission.ts
   ```

6. **Gegenprobe Happy-Path** (optional, bestätigt das Reset)
   Dieselbe Löschung erneut auslösen → **200**, Datei verschwindet, `deleted_at` gesetzt,
   `media_url` **genullt** (0011).

## Erwartetes Ergebnis

| Prüfung              | Fehlerpfad (Schritt 4) | Happy-Path (Schritt 6) |
| -------------------- | ---------------------- | ---------------------- |
| HTTP-Status          | 500                    | 200                    |
| `deleted_at`         | NULL (unverändert)     | gesetzt                |
| `media_url`          | gesetzt (unverändert)  | NULL                   |
| Datei in `ugc-media` | vorhanden              | entfernt               |

Nach bestandenem Lauf: Punkt 1 in der Memory `gdpr-delete-open-items` als erledigt markieren.
