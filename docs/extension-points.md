# Extension Points — einen Sektor / Flow-Modus (wieder) aktivieren

> Zweck: die **schriftliche, geprüfte Anleitung**, wie ein deaktivierter Sektor oder Flow-Modus
> aktiviert wird. Wenn diese Anleitung kurz bleibt und auf vorhandenen Code zeigt, ist die
> Architektur nachweislich erweiterbar — ohne toten Stub-Code und ohne offene Sicherheitsfläche.

## Invariante (aktueller Zustand)

**Aktiv sind `tourism / tour / gallery` UND `tourism / stay / feedback`** (Hotel-Feedback; seit
Migration `0009`). Die Garantie besteht aus zwei Schichten:

1. **DB-CHECK**: `tenants.sector = 'tourism'` (0006). `events.campaign_type in ('tour', 'stay')`
   und `events.flow_mode in ('gallery', 'feedback')` — `0006_lockdown_tourism_gallery.sql` verengte
   auf je einen Wert, `0009_reopen_tourism_stay_feedback.sql` erweiterte um stay/feedback. Weiterhin
   **nicht speicherbar**: `flow_mode = 'guestbook'` sowie die Sektoren `real_estate`/`event`/`agency`
   — eine solche Zeile kann physisch nicht existieren.
2. **Registry** (`lib/sectors/index.ts`): `tourism` mit `tour` + `stay` sind in `SECTORS` +
   `CAMPAIGN_TYPES` eingetragen. UI, Validierung und Gäste-Flow leiten sich vollständig hieraus ab.

**RLS-Update (0009): `public_gallery_select` IST jetzt flow-mode-aware.** Die Policy filtert über
den SECURITY-DEFINER-Helfer `is_gallery_event(event_id)` — nur `gallery`-Events erreichen die
Gäste-Galerie, sodass private Feedback-Kommentare NIE an andere Gäste gelangen (B1-Audit, atomar in
derselben Migration wie die CHECK-Öffnung). `public_select_events` (Event-Stammdaten) bleibt
öffentlich lesbar; sensible Felder filtert der API-Handler. **Wer künftig einen weiteren
guest-sichtbaren Modus reaktiviert, muss `public_gallery_select` erneut prüfen** (siehe Schritt 4).

## Vorhandener Code als Vorlage (dormant, nicht gelöscht)

| Konzept                           | Ort (deaktiviert/dormant)                                             |
| --------------------------------- | --------------------------------------------------------------------- |
| Sektor-Modul `event` (Momento)    | `lib/sectors/event/index.ts`                                          |
| Sektor-Modul `real_estate`        | `lib/sectors/real_estate/index.ts`                                    |
| Sektor-Modul `agency` (Reisebüro) | `lib/sectors/agency/index.ts`                                         |
| Flow-Modus-Capabilities/Labels    | `lib/sectors/types.ts` (`FLOW_MODE_CAPABILITIES`, `FLOW_MODE_LABELS`) |
| Gäste-Flow `guestbook`            | `app/e/[eventId]/GuestbookFlow.tsx`                                   |
| Route Gästebuch-Gruß              | `app/api/events/[eventId]/_guestbook/route.ts`                        |

> `feedback` ist NICHT mehr dormant: `FeedbackFlow.tsx` + `app/api/events/[eventId]/feedback/route.ts`
> (ohne `_`) sind seit `0009` aktiv (Hotel/`stay`). Ergänzend liefert `0010` die RPC `attach_feedback`
> (rating/comment an einen Medien-Beitrag anhängen, ownership-geprüft).
>
> Die **Self-Service-Registrierung** ist ebenfalls NICHT mehr dormant: `app/signup/` (ohne `_`) ist
> aktiv. Der **Sektor wird bei der Registrierung gewählt** (aus der aktiven Registry; aktuell nur
> `tourism`) und reist via `raw_user_meta_data` zum Trigger `handle_new_user` (`0015`). Dort greifen
> zwei Schichten: Trigger-Allowlist (Spiegel von `SECTOR_TUPLE`) + DB-CHECK (`tenants.sector = 'tourism'`,
> 0006). `real_estate`/`event`/`agency` bleiben CHECK-gesperrt — das Aktivieren eines dieser Sektoren
> öffnet den CHECK und macht ihn damit automatisch auch im Signup auswählbar.
>
> **Immutabilität des Sektors (WARNUNG für spätere Änderungen).** Der Sektor ist nach der Registrierung
> unveränderlich. Das wird aktuell **allein durch das FEHLEN einer UPDATE-Policy** auf `tenants`
> durchgesetzt, die einem Kunden das Ändern von `sector` erlaubte (es gibt keinen Änderungs-Pfad).
> Wird künftig eine UPDATE-Policy auf `tenants` ergänzt (z. B. um `brand_name` editierbar zu machen),
> **MUSS** sie `sector` per `WITH CHECK` (z. B. `sector = (select sector from …)` bzw. Spaltenschutz)
> gegen Änderung sichern — sonst bricht die Immutabilität. Eine DB-seitige BEFORE-UPDATE-Sperre ist
> bewusst noch nicht Teil dieses Slices.

Die Tupel in `lib/sectors/types.ts` (`SECTOR_TUPLE`, `CAMPAIGN_TYPE_TUPLE`, `FLOW_MODE_TUPLE`)
sind bewusst **breit** geblieben, damit dieser Code weiter kompiliert. Reaktivieren heißt daher:
Registry-Eintrag + CHECK erweitern (+ ggf. RLS-Audit) — keine Typänderungen nötig.

## Rezept — einen deaktivierten Sektor/Modus aktivieren

Beispiel: `event` / `wedding` / `guestbook` wieder aktivieren. (Ein bereits durchgeführtes, echtes
Beispiel dieses Rezepts ist `tourism / stay / feedback` in Migration `0009` — inklusive Schritt 4,
dem B1-Gallery-Audit via `is_gallery_event`.)

1. **Migration — CHECK erweitern** (neue Datei `supabase/migrations/00NN_*.sql`, drop + recreate):

   ```sql
   alter table public.tenants drop constraint if exists tenants_sector_check;
   alter table public.tenants add constraint tenants_sector_check
     check (sector in ('tourism', 'event'));

   alter table public.events drop constraint if exists events_campaign_type_check;
   alter table public.events add constraint events_campaign_type_check
     check (campaign_type in ('tour', 'wedding'));

   alter table public.events drop constraint if exists events_flow_mode_check;
   alter table public.events add constraint events_flow_mode_check
     check (flow_mode in ('gallery', 'guestbook'));
   ```

   Danach `npx supabase gen types typescript --local > types/database.ts`.
   Führt die Reaktivierung eine **neue Tabelle** ein: an die GRANTs denken. `0007_grants.sql`
   setzt `alter default privileges`, sodass von Migrationen (als DB-Owner) erstellte Tabellen
   automatisch für `anon`/`authenticated`/`service_role` berechtigt sind. Ohne GRANT scheitert
   der Zugriff mit `42501` (permission denied), bevor RLS greift — RLS-Policy für die neue
   Tabelle ebenfalls nicht vergessen.

2. **Registry — Modul eintragen** (`lib/sectors/index.ts`): das Modul importieren und in
   `SECTORS` + `CAMPAIGN_TYPES` ergänzen (Vorlage: der bestehende `tourism`-Eintrag; das
   `event`-Modul liegt bereits unter `lib/sectors/event/`):

   ```ts
   import { event } from './event'
   // ...
   export const SECTORS: Partial<Record<Sector, SectorConfig>> = {
     tourism: { label: tourism.label, campaignTypes: ['tour'] },
     event: { label: event.label, campaignTypes: ['wedding'] },
   }
   export const CAMPAIGN_TYPES: Partial<Record<CampaignType, CampaignTypeConfig>> = {
     tour: tourism.campaignTypes.tour,
     wedding: event.campaignTypes.wedding,
   }
   ```

   `resolveFlowMode()` bleibt der einzige Dispatch-Punkt — nichts weiter zu ändern.

3. **Capabilities/Labels prüfen**: für `guestbook`/`feedback` bereits in `lib/sectors/types.ts`
   vorhanden. Ein **neuer** Modus braucht dort je einen `FLOW_MODE_CAPABILITIES`- und
   `FLOW_MODE_LABELS`-Eintrag (und den Wert in `FLOW_MODE_TUPLE`).

4. **Sicherheit — RLS-Audit (PFLICHT bei guest-sichtbaren Daten):** Prüfe, ob der reaktivierte
   Modus Zeilen erzeugt, die über `public_gallery_select` / `public_select_events` an Gäste
   gelangen könnten. Private Feedback-/Gästebuch-Kommentare (`submissions.comment` /
   `guest_name`) dürfen **nicht** öffentlich lesbar sein. Falls nötig, eine `flow_mode`-Bedingung
   in `public_gallery_select` ergänzen — **in derselben Migration** wie Schritt 1 und mit Test
   (siehe Schritt 6, Isolationsprüfung).

5. **Gäste-Flow + Route reaktivieren**:
   - In `app/e/[eventId]/GuestFlow.tsx` den Dispatch-Zweig wieder ergänzen
     (`if (flowMode === 'guestbook') return <GuestbookFlow {...rest} />`).
   - Die Route zurückbenennen (`_`-Präfix entfernen): `app/api/events/[eventId]/_guestbook`
     → `.../guestbook`. (Die Self-Service-Registrierung ist bereits aktiv und sektor-unabhängig;
     sie muss beim Reaktivieren eines Sektors nicht mehr angefasst werden.)

6. **Tests** — mindestens:
   - `tests/sectors.test.ts`: aktive Registry-Erwartungen anpassen (`Object.keys(SECTORS)`,
     `campaignTypesForSector`, `resolveFlowMode`, `isCampaignType`).
   - Isolationsprüfung (DB): `insert` mit dem neuen Wert **gelingt**; ein weiterhin gesperrter
     Wert **verstößt** gegen den CHECK; Cross-Tenant-Read liefert 0 Zeilen (RLS).
   - Bei Schritt 4: ein guest-sichtbarer Read darf **keinen** privaten `comment`/`guest_name`
     eines fremden `flow_mode` zurückgeben.

## Dashboard — einen neuen Sektor aufnehmen (Audit-Ergebnis + Rezept)

> Ergänzt das obige Rezept um die **Dashboard-Dimension**: Was muss am Betreiber-Dashboard
> geändert werden, wenn ein neuer Sektor aktiviert wird? Antwort aus dem Audit: bei
> Wiederverwendung vorhandener Flow-Modi **nichts** — nur Config.

### Audit-Fazit

Das Dashboard ist **sektor-agnostisch**. Es gibt **keine** `sector === …`- oder
`campaignType === …`-Verzweigung. Alles Sektor-/Typ-Spezifische wird aus der Registry
(`lib/sectors/`) abgeleitet. Die **einzige** hartcodierte Achse ist `flow_mode`
(`gallery` / `feedback` / `guestbook`) — die bewusste Dispatch-Achse.

Woher jede Dashboard-Ansicht ihre Sektor-Info zieht (Nachweis):

| Ansicht                               | Datei                       | Quelle                                                  |
| ------------------------------------- | --------------------------- | ------------------------------------------------------- |
| Übersicht KPIs + Typ-Label            | `dashboard/page.tsx`        | generisch + `getCampaignConfig` (Config)                |
| Anlegen: Kampagnentyp-Auswahl         | `events/new/page.tsx`       | `campaignTypesForSector` + `CAMPAIGN_TYPES` (Config)    |
| Anlegen: Branche-Label                | `events/new`, `settings`    | `SECTORS[sector].label` (Config)                        |
| Einstellungen: verfügbare Typen       | `settings/page.tsx`         | `campaignTypesForSector` (Config)                       |
| Detail: Typ-Rozette + Feedback-Fragen | `events/[eventId]/page.tsx` | `getCampaignConfig` / `getFeedbackQuestions` (Config)   |
| Detail: Liste + Kennzahlen            | `events/[eventId]/page.tsx` | `flow_mode`-Verzweigung (hartcodiert, s. B1)            |
| Validierung beim Anlegen              | `events/new/actions.ts`     | `isValidCampaignForSector` / `resolveFlowMode` (Config) |

### Rezept — Config-Berührungspunkte (das ist alles)

1. **Sektor-Modul** `lib/sectors/<id>/index.ts` (Vorlagen: `tourism`, `event`, `real_estate`) —
   Kampagnentypen, Labels, `defaultFlowMode`, `allowFlowModeChoice`, optional `questions[]`.
2. **Registry** `lib/sectors/index.ts`: Eintrag in `SECTORS` **und** `CAMPAIGN_TYPES`.
3. **Migration**: CHECK-Werte erweitern (`tenants.sector` / `events.campaign_type` /
   `events.flow_mode`) — siehe obiges Rezept, Schritt 1.
4. **Optional**: `questions[]` im Kampagnentyp (strukturiertes Feedback; wird generisch in
   `submissions.feedback_answers` gespeichert — kein Sonderfall-Code).

Mehr ist am Dashboard **nicht** nötig, solange der Sektor **vorhandene** Flow-Modi nutzt.

### Hartcodierte Stellen — Bruchpunkte NUR bei einem NEUEN flow_mode (nicht bei neuem Sektor)

- **B1** `events/[eventId]/page.tsx`: Detailansicht + `statCards` verzweigen je `flow_mode`
  (`feedback` / `guestbook` / `gallery`): Listen-Layout, Leerzustand, Kennzahl-Karten. Ein
  **neuer** Modus braucht hier einen Zweig. (Der `guestbook`-Zweig existiert bereits, obwohl
  der Modus dormant ist.)
- **B2** `events/new/page.tsx`: Die Flow-Modus-Auswahl (nur bei `allowFlowModeChoice`) listet
  fest „Feedback" + „Galerie" mit fixem Text. Ein Kampagnentyp, der ein **anderes** Modus-Paar
  anbietet, bräuchte hier eine config-getriebene Optionsliste.
- **B3** `events/new/page.tsx`: Namens-Platzhalter „z. B. Altstadt-Tour …" ist tourismus-gefärbt
  (kosmetisch).

**Keiner** dieser Punkte ist sektor-abhängig → ein neuer Sektor mit vorhandenen Modi berührt sie
nicht. Konkret: `real_estate/property` (feedback + gallery) und `event/wedding` (guestbook) laufen
im Dashboard **ohne Codeänderung**, weil alle drei `flow_mode`-Zweige bereits existieren.

### Refactor-Schuld (JETZT dokumentieren, NICHT bezahlen)

- Die `flow_mode`-Verzweigung liegt **doppelt** vor: Gäste-Flow (`app/e/[eventId]/GuestFlow.tsx`)
  **und** Dashboard-Detail (B1). Ein neuer Modus muss an beiden Stellen ergänzt werden.
  Zentralisierung über `FLOW_MODE_CAPABILITIES` (datengetriebenes Rendering) wäre möglich, ist
  aber ein eigener Refactor — erst fällig, wenn ein **vierter** Modus kommt.
- B2 sollte die angebotenen Modi je Kampagnentyp aus der Config lesen (z. B. ein Feld
  `offeredFlowModes` am Kampagnentyp) statt sie hart zu listen.

### Tests für einen neuen Sektor

- **Registry-Test** (`tests/sectors.test.ts`): `Object.keys(SECTORS)`, `campaignTypesForSector`,
  `resolveFlowMode`, `isCampaignType` für die neuen Werte.
- **DB-Isolations-Proof** (Muster: `signup_trigger_proof.sql` / `rls_lockdown_proof.sql`): Insert
  mit neuem `sector` / `campaign_type` / `flow_mode` **gelingt**; ein gesperrter Wert **verstößt**
  gegen den CHECK; Cross-Tenant-Read liefert 0 Zeilen (RLS).
- **Nur bei NEUEM guest-sichtbaren `flow_mode`**: B1-Gallery-Audit (`is_gallery_event`) + neuer
  Dashboard-Detail-Zweig (B1) + Test, dass kein fremder privater `comment`/`guest_name` sichtbar
  wird.

### Worked example: `flow_mode` gallery ↔ feedback (bereits gebaut)

`tourism / stay / feedback` wurde per Migration `0009` aktiviert — **ohne Dashboard-Code zu
ändern**: der Detail-Zweig `flow_mode === 'feedback'` und seine `statCards` existierten bereits;
hinzu kamen nur Config (`stay`-Kampagnentyp inkl. `questions[]`) und der CHECK. Genau dieser Pfad
gilt für einen neuen Sektor, der einen vorhandenen Modus nutzt. Wird hingegen ein **neuer** Modus
gebraucht, zeigt derselbe `0009`-Vorgang den vollen Umfang: Capabilities/Labels (`types.ts`),
Gäste-Flow-Zweig, Dashboard-Detail-Zweig (B1) und das RLS-Audit — alles atomar in einer Migration.

## Selbsttest der Architektur

Bleibt dieses Rezept kurz und zeigt es auf vorhandenen Code (`lib/sectors/event/`,
`lib/sectors/real_estate/`), sind die Nahtstellen gut. Wird es lang und verzweigt, sind die
Seams schlecht — und das ist auf dem Papier erkannt, bevor Code für einen zweiten Sektor
geschrieben wird.
