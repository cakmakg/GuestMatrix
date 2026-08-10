# Wedding Enrichment — Plan

> Beachhead-Erweiterung des Event-Sektors (`event / wedding / guestbook`, aktiv seit `0018`).
> Ziel: den Gäste-Flow anreichern und dem Veranstalter (Brautpaar) event-basierte
> Sichtbarkeitsmodi geben — ohne die Sektor-/Flow-Architektur (`lib/sectors/` + `flow_mode`)
> aufzuweichen und ohne die bewiesene **geschlossene** Gästebuch-Garantie zu brechen.

## Kontext & feste Entscheidungen

- **Sichtbarkeits-Architektur:** neue, zu `flow_mode` **orthogonale** Achse `events.visibility`
  (nicht `flow_mode`-Auswahl). Das Gast-Erlebnis (Name + Gruß + Medien) bleibt konstant; nur
  **wer liest**, ändert sich. — _festgelegt._
- **Erste Scheibe:** Dilim A (Gäste-Flow-Anreicherung). — _festgelegt._
- **Sprachnachricht: verworfen** — nur Video (im Gästebuch bereits unterstützt). Kein `audio`-Typ.
- **Fun-Frage speichern:** strukturiert über `feedback_answers` (generisch), typ-bewusst. — _festgelegt._
- **Unantastbar:** das mit `event_guestbook_rls_proof.sql` (11/11) bewiesene **geschlossene**
  Gästebuch (B1-Gate `is_gallery_event`) bleibt in Dilim A **unverändert**; die Sichtbarkeitsöffnung
  ist ausschließlich Sache von Dilim B/C/D.

---

## DİLİM A (aktiv) — Strukturierte Fun-Frage im Gästebuch

**Ziel:** eine optionale, kurze Freitext-Frage („Beschreibt die Feier in drei Worten"), generisch
in `submissions.feedback_answers` gespeichert. **Keine Sichtbarkeitsänderung → kein RLS-Proof nötig;**
das geschlossene Modell bleibt.

### Migration `0019_wedding_fun_prompt.sql` (Muster 0012/0016, drop+recreate der Funktion)

`validate_feedback_answers` wird **typ-bewusst**: pro `campaign_type` zwei Allowlists —
**Scale**-Schlüssel (Wert = ganze Zahl 1–5) und **Text**-Schlüssel (Wert = String, Längenlimit).

- `stay` → Scale `cleanliness/service/location/value` (**unverändert**).
- `agency` → Scale `experience/organization/service/value` (**unverändert**).
- `wedding` → **Text** `three_words` (max. 60 Zeichen).

Die strukturelle CHECK (object-or-null) und der `trg_validate_feedback_answers`-Trigger bleiben →
beide Schreibpfade (medienloser INSERT via `guest_insert_submission`, Attach via `attach_feedback`)
sind automatisch als letzte Verteidigungslinie abgedeckt (Defense-in-Depth, jsonb ist schemalos).

### Code

| Datei                                         | Änderung                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `lib/sectors/types.ts`                        | `FeedbackQuestion.type: 'rating' \| 'text'` (+ optional `maxLength` für Text)                                            |
| `lib/sectors/event/index.ts`                  | `wedding.questions = [{ id:'three_words', type:'text', maxLength:60, … }]` (optional)                                    |
| `lib/validation/schemas.ts`                   | `feedbackAnswersSchema`-Wert `number(1–5) \| string`; `answers` optional an `presignSchema` + `guestbookMessageSchema`   |
| `lib/sectors/index.ts`                        | Helfer `invalidAnswerTypes` (Wert-Typ ↔ Fragentyp); `unknownAnswerKeys` auf `number \| string` geweitet                  |
| `app/api/submissions/presign/route.ts`        | optional `answers`: Katalog- + Typ-Prüfung, dann `feedback_answers` mit-inserten                                         |
| `app/api/events/[eventId]/guestbook/route.ts` | dito (medienloser Pfad)                                                                                                  |
| `app/api/events/[eventId]/feedback/route.ts`  | `invalidAnswerTypes`-Prüfung ergänzt (saubere UX-Ablehnung für stay/agency)                                              |
| `app/e/[eventId]/GuestbookFlow.tsx`           | `labels.questions` rendern (Text = Kurz-Input); Antwort **einmal** senden (mit erstem Upload, sonst am medienlosen POST) |
| `app/dashboard/events/[eventId]/page.tsx`     | Text-Antwort im Gästebuch-Zweig anzeigen; `feedback_answers`-Typ auf `number \| string`                                  |

### Tests + „Fertig"

- `tests/sectors.test.ts`: wedding-Katalog (`three_words`, Typ `text`) + `invalidAnswerTypes`.
- `tests/schemas.test.ts`: `feedbackAnswersSchema` akzeptiert String; `presign`/`guestbook` mit `answers`.
- `supabase/tests/wedding_fun_prompt_proof.sql` (4 Szenarien):
  1. wedding `three_words` → **String akzeptiert**, Zahl **abgelehnt** (Typ-Konflikt).
  2. stay `cleanliness` → weiterhin Zahl 1–5 **erzwungen**, String **abgelehnt** (Regression: altes Verhalten erhalten).
  3. unbekannter Schlüssel weiterhin **abgelehnt** (0012-Garantie).
  4. **beide** Eingabepfade (presign + medienloser Gästebuch-POST) durchlaufen die neue Typ-Prüfung.
- **Fertig =** Validierung + Fehlerpfade + ≥1 Test + deploybar. Sichtbarkeit unverändert → kein RLS-Proof.

---

## NÄCHSTE SCHEIBEN — Sichtbarkeitsachse `events.visibility` (B/C/D)

> Getrennte PRs. Öffnen bewusst gast-sichtbare Lesepfade → jede Scheibe mit RLS-Audit im Muster 0018.

**Dilim B — `visibility`-Achse + sichtbarkeits-bewusste RLS (Architektur-Kern, sicherheitslastig)**

- Migration: `events.visibility` (`private` Default = heutiges geschlossenes Modell / `shared` /
  `moderated`) + CHECK; Auswahl im Dashboard `events/new` für Hochzeit.
- **RLS-Neu-Audit (PFLICHT):** der gast-sichtbare Lesepfad wird `visibility`-bewusst (neuer Helfer).
  `private` nie öffentlich; `shared` geöffnet; `moderated` nur, wenn freigegeben. Wie `0018`
  **atomar in derselben Migration** ein neuer Proof (private Regression + shared/moderated-Öffnung).
- **Consent-Text `visibility`-abhängig (rechtlich):** wer „nur das Brautpaar sieht" zustimmt, darf
  nicht öffentlich erscheinen → `visibility` bei Event-Erstellung gesetzt und nach der ersten
  Einreichung **nicht in die offenere Richtung änderbar** (oder Consent je Einreichung).

**Dilim C — Geteilte Galerie für Gäste (UI)** — bei `shared`/`moderated` sehen Gäste die
freigegebenen Beiträge (GalleryFlow-Muster auf Gästebuch-Inhalt).

**Dilim D — Moderierte Live-Fotowand** — öffentliche `/e/[eventId]/wall` (Großbildschirm,
Realtime/Polling), nur freigegebene Medien; `moderated` = Freigabe-vor-Anzeige (Umkehr der heutigen
`moderation_flag`-Default-Sichtbarkeit) + Freigabe-Queue im Dashboard.

## Außerhalb des Umfangs (dieser Plan ist Hochzeit-fokussiert)

Firmen-/Konferenz-Feedback und Messe-/Lead-Capture sind **neue Sektoren/Kampagnentypen** per
`docs/extension-points.md`-Rezept (neues `lib/sectors/`-Modul + CHECK), kein Sonderfall-Code im
Hochzeit-Pfad. Messe-„Lead-Capture" ist wahrscheinlich ein **neuer** `flow_mode` (Kurzformular +
CRM-Export) — eigener Entwurf.
