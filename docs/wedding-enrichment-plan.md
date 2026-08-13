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

## DİLİM B (erledigt, Auswahl aber ABGESCHALTET) — Sichtbarkeitsachse `events.visibility`

**Gebaut und bewiesen** (Migration `0021`): Spalte `visibility` (`private` Default = das bisherige
geschlossene Modell / `shared` / `moderated`) + CHECK (nur `guestbook` darf ≠ private sein),
SECURITY-DEFINER-Helfer `is_shared_guestbook_event`, gast-sichtbare Policy
`public_guestbook_select` (ohne Reciprocity-Gate) und **Unveränderlichkeit nach dem Anlegen**
(`tenant_update_own_events` WITH CHECK gegen `stored_event_visibility`).
Proof `supabase/tests/event_visibility_rls_proof.sql`: **11/11**, inkl. private-Regression,
moderated-Gating über `moderation_flag` und abgelehntem visibility-UPDATE.

**Die Auswahl wird dem Kunden aber NICHT angeboten** (`event.wedding.allowVisibilityChoice =
false`, 2026-08-13):

Der Lesepfad ist offen, aber **kein Bildschirm liest ihn** — eine Suche nach
`public_guestbook_select` / `is_shared_guestbook_event` im Anwendungscode liefert null Treffer.
Der Bildschirm, auf dem ein Gast fremde Beiträge sieht, IST Dilim C. Böte man die Wahl trotzdem an,
verspräche der Einwilligungstext bei `shared`/`moderated` („ALLEN Gästen dieser Feier gezeigt")
etwas, das nichts einlöst — ein gebrochenes Versprechen gegenüber dem Gast wiegt schwerer als eine
fehlende Option.

**Wieder aufmachen:** die eine Zeile in `lib/sectors/event/index.ts` auf `true` setzen. Datenpfad,
Consent-Texte (`GUESTBOOK_VISIBILITY_CONSENT_TEXT`), Formular-Block und Proof sind fertig; der Test
`tests/sectors.test.ts` erwartet heute bewusst `false` und ist dann anzupassen.

## ZURÜCKGESTELLT — C und D (2026-08-13)

Beide sind **Produkterweiterungen, keine Voraussetzungen**. Das Produkt, wie es beschrieben ist —
QR am Tisch → Name + Glückwunsch + Fotos/Videos → sichere Ablage → Panel für das Brautpaar —
kommt ohne sie aus; es braucht nur `private`, und das gab es schon vor `0021`.

**Dilim C — Geteilte Galerie für Gäste (UI)** — bei `shared`/`moderated` sehen Gäste die
freigegebenen Beiträge (GalleryFlow-Muster auf Gästebuch-Inhalt). Voraussetzung dafür, die
Sichtbarkeitswahl überhaupt anbieten zu dürfen (siehe oben).

**Dilim D — Moderierte Live-Fotowand** — öffentliche `/e/[eventId]/wall` (Großbildschirm,
Realtime/Polling), nur freigegebene Medien; `moderated` = Freigabe-vor-Anzeige (Umkehr der heutigen
`moderation_flag`-Default-Sichtbarkeit) + Freigabe-Queue im Dashboard.

## Außerhalb des Umfangs (dieser Plan ist Hochzeit-fokussiert)

Firmen-/Konferenz-Feedback und Messe-/Lead-Capture sind **neue Sektoren/Kampagnentypen** per
`docs/extension-points.md`-Rezept (neues `lib/sectors/`-Modul + CHECK), kein Sonderfall-Code im
Hochzeit-Pfad. Messe-„Lead-Capture" ist wahrscheinlich ein **neuer** `flow_mode` (Kurzformular +
CRM-Export) — eigener Entwurf.
