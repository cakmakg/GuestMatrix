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

> **Stand 2026-07-31: ausgeführt und bestanden** — Fehlerpfad HTTP 500, `deleted_at` NULL, Datei
> erhalten (zwei Läufe reproduzierbar); Methode: Storage-Container gestoppt (siehe Prinzip).

## Prinzip

Ein echter Storage-Fehler wird deterministisch erzwungen, indem der **Storage-Container gestoppt**
wird (`docker stop supabase_storage_guestmatrix`). `remove()` läuft dann ins Leere („fetch failed" /
„name resolution failed") — ein echter Fehler, den `deleteSubmission` abfängt. **Es wird kein Code
geändert**: getestet wird der echte Produktionspfad (echter `supabaseAdmin`, echter Bucket, echter
Pfad), nur der Storage-Dienst ist ausgefallen. DB und Auth laufen weiter, sodass der Ownership-Read
(Schritt 1 von `deleteSubmission`) normal durchläuft und der Fehler erst beim Storage-Remove auftritt.

> **Warum nicht „nicht existierender Bucket"?** Die naheliegende Variante — `BUCKET` temporär auf
> einen nicht existierenden Namen setzen — funktioniert auf **lokalem** Supabase-Storage NICHT:
> `remove()` gegen einen fehlenden Bucket liefert dort `error: null, data: []` (KEIN Fehler). Der
> Fail-Path würde gar nicht ausgelöst, der DELETE gäbe fälschlich **200** zurück und committete den
> Soft-Delete (die Datei bliebe liegen) — ein **falsches PASS**. Nur ein tatsächlich ausgefallener
> Storage-Dienst erzwingt hier einen echten Fehler. (Empirisch bestätigt am 2026-07-31.)

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

2. **Storage-Ausfall erzwingen** (kein Code-Edit)
   Den Storage-Container stoppen:

   ```bash
   docker stop supabase_storage_guestmatrix
   ```

   > Containername ggf. prüfen: `docker ps --filter name=storage --format '{{.Names}}'`
   > (Muster `supabase_storage_<projekt>`). Nur Storage fällt aus — DB und Auth laufen weiter.

3. **Als Eigentümer löschen**
   Mit der Session des Gastes, der die Datei hochgeladen hat (oder des besitzenden Tenants), die
   Löschung auslösen — am besten per `curl -i` (zeigt den echten Status):

   ```bash
   curl -i -X DELETE http://localhost:3000/api/submissions/<submissionId> \
     -H 'Cookie: <deine-Session-Cookies>'
   ```

   > Nicht über den Lösch-Button des Gäste-Flows prüfen: dieser wertet die Antwort NICHT aus
   > (fire-and-forget `fetch`, `GalleryFlow.tsx`/`FeedbackFlow.tsx`) und meldet „gelöscht" auch bei
   > **500**. Der HTTP-Status ist nur per `curl -i` bzw. im DevTools-Network-Tab sichtbar; die
   > DB-/Storage-Assertions (Schritt 4) sind davon unabhängig und bleiben die Hauptbelege.

4. **Assertions**
   - **HTTP 500** mit Body `{"error":"Löschung fehlgeschlagen, bitte erneut versuchen."}`.
   - Server-Log enthält `[gdpr_delete] storage_remove_failed`.
   - DB: `select deleted_at, media_url from public.submissions where id = '<submissionId>';`
     → `deleted_at` weiterhin **NULL**, `media_url` weiterhin **gesetzt** (Fail-safe hielt).
   - Storage: Zieldatei ist **weiterhin vorhanden**.

5. **Zurücksetzen** (Pflicht)
   Storage-Dienst wieder starten:

   ```bash
   docker start supabase_storage_guestmatrix
   ```

   > Kurz warten, bis Storage wieder antwortet (Objekt-Info liefert wieder `200`), bevor Schritt 6
   > läuft. Da kein Code geändert wurde, ist **kein `git checkout` nötig**.

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

Bestanden am 2026-07-31; die Memory `gdpr-delete-open-items` ist entsprechend geschlossen.
