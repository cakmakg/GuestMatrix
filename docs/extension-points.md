# Extension Points — einen Sektor / Flow-Modus (wieder) aktivieren

> Zweck: die **schriftliche, geprüfte Anleitung**, wie ein deaktivierter Sektor oder Flow-Modus
> aktiviert wird. Wenn diese Anleitung kurz bleibt und auf vorhandenen Code zeigt, ist die
> Architektur nachweislich erweiterbar — ohne toten Stub-Code und ohne offene Sicherheitsfläche.

## Invariante (aktueller Zustand)

**Aktiv sind `tourism / agency / gallery` (+ Feedback-Katalog), `tourism / stay / feedback`**
(Hotel-Feedback; seit Migration `0009`) **UND `event / wedding / guestbook`** (Hochzeit/Event;
seit Migration `0018`). Der frühere Kampagnentyp `tour` wurde von
`0016_remodel_tour_to_agency.sql` zu `agency` umbenannt (Beachhead-Repositionierung auf
Reiseagenturen), behält den gallery-Flow und erhielt einen strukturierten Feedback-Katalog
(Reiseerlebnis + Agentur-Service) — kein neuer flow_mode, nur die vorhandene gallery+
feedback_answers-Mechanik. Die Garantie besteht aus zwei Schichten:

1. **DB-CHECK**: `tenants.sector in ('tourism', 'event')` (0006 verengte auf tourism, `0018` öffnete
   event). `events.campaign_type in ('agency', 'stay', 'wedding')` (0016 tauschte `tour`→`agency`,
   0018 ergänzte `wedding`) und `events.flow_mode in ('gallery', 'feedback', 'guestbook')` —
   `0006_lockdown_tourism_gallery.sql` verengte auf je einen Wert, `0009_reopen_tourism_stay_feedback.sql`
   erweiterte um stay/feedback, `0018_activate_event_wedding_guestbook.sql` um wedding/guestbook.
   Weiterhin **nicht speicherbar**: der Sektor `real_estate` sowie der DORMANTE Sektor
   `lib/sectors/agency/` (nicht zu verwechseln mit dem AKTIVEN Kampagnentyp `agency` im
   tourism-Sektor) und dessen Kampagnentyp `trip`/`property` — eine solche Zeile kann physisch
   nicht existieren.
2. **Registry** (`lib/sectors/index.ts`): `tourism` mit `agency` + `stay` und `event` mit `wedding`
   sind in `SECTORS` + `CAMPAIGN_TYPES` eingetragen. UI, Validierung und Gäste-Flow leiten sich
   vollständig hieraus ab.

**business_type-Unterrolle (0017): `hotel` vs. `agency` INNERHALB von tourism.** Der tourism-Sektor
ist in zwei Geschäftsmodelle geteilt (`tenants.business_type` ∈ {hotel, agency}) — KEIN Sektor-Split.
Die Zuordnung ist keine Identität: `hotel → campaign_type=stay`, `agency → campaign_type=agency`.
Sie wird an EINER Stelle in der DB gehalten (`current_tenant_allows_campaign`, security definer +
`search_path=''` + stable) und von `lib/sectors/` (`BUSINESS_TYPES` + `businessTypes` je Sektor)
gespiegelt. Die Grenze ist **hart**: `events`-INSERT/UPDATE tragen eine RLS-`WITH CHECK`, die
`campaign_type` gegen die business_type des Tenants prüft — ein Hotel kann per direktem API-Aufruf
kein agency-Event anlegen (Nachweis: `business_type_boundary_proof.sql`, (a)). NULL-Sicherheit: eine
`business_type IS NULL` (nur NICHT-tourism-Tenants) passiert die Grenze ungehindert; `sector='tourism'
AND business_type IS NULL` ist per `tenants_business_type_check` unmöglich, also kein Loch. Neuer Sektor
mit eigenen Geschäftsmodellen → `businessTypes` im Sektor-Modul + `tenants_business_type_check`
erweitern; ein Sektor OHNE business_type lässt die Spalte NULL (keine business-Grenze).

**RLS-Update (0009): `public_gallery_select` IST jetzt flow-mode-aware.** Die Policy filtert über
den SECURITY-DEFINER-Helfer `is_gallery_event(event_id)` — nur `gallery`-Events erreichen die
Gäste-Galerie, sodass private Feedback-Kommentare NIE an andere Gäste gelangen (B1-Audit, atomar in
derselben Migration wie die CHECK-Öffnung). `public_select_events` (Event-Stammdaten) bleibt
öffentlich lesbar; sensible Felder filtert der API-Handler. **Wer künftig einen weiteren
guest-sichtbaren Modus reaktiviert, muss `public_gallery_select` erneut prüfen** (siehe Schritt 4).

## Vorhandener Code als Vorlage (dormant, nicht gelöscht)

| Konzept                                               | Ort (deaktiviert/dormant)                                      |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| Sektor-Modul `real_estate`                            | `lib/sectors/real_estate/index.ts`                             |
| Sektor-Modul `agency` (Reisebüro)                     | `lib/sectors/agency/index.ts`                                  |
| Breite Typ-Tupel (halten dormanten Code kompilierbar) | `lib/sectors/types.ts` (`SECTOR_TUPLE`, `CAMPAIGN_TYPE_TUPLE`) |

> `feedback` ist NICHT mehr dormant: `FeedbackFlow.tsx` + `app/api/events/[eventId]/feedback/route.ts`
> (ohne `_`) sind seit `0009` aktiv (Hotel/`stay`). Ergänzend liefert `0010` die RPC `attach_feedback`
> (rating/comment an einen Medien-Beitrag anhängen, ownership-geprüft).
>
> Auch `guestbook` ist NICHT mehr dormant: seit `0018` sind der Sektor `event` (`lib/sectors/event/`),
> `GuestbookFlow.tsx` und `app/api/events/[eventId]/guestbook/route.ts` (ohne `_`) aktiv
> (Hochzeit/`wedding`, geschlossenes Gästebuch). Damit sind **alle drei** Flow-Modi
> (`gallery`/`feedback`/`guestbook`) aktiv; dormant bleiben nur noch ganze Sektoren (`real_estate`,
> `agency`), deren Werte `lib/sectors/types.ts` bewusst breit in den Tupeln hält.
>
> Die **Self-Service-Registrierung** ist ebenfalls NICHT mehr dormant: `app/signup/` (ohne `_`) ist
> aktiv. Der **Sektor wird bei der Registrierung gewählt** (aus der aktiven Registry; aktuell `tourism`
> und `event`) und reist via `raw_user_meta_data` zum Trigger `handle_new_user` (`0015`). Dort greifen
> zwei Schichten: Trigger-Allowlist (Spiegel von `SECTOR_TUPLE`) + DB-CHECK
> (`tenants.sector in ('tourism', 'event')`; 0006 verengte auf tourism, `0018` öffnete event).
> `real_estate` und der dormante Sektor `agency` bleiben CHECK-gesperrt — das Aktivieren eines dieser
> Sektoren öffnet den CHECK und macht ihn damit automatisch auch im Signup auswählbar.
>
> **Immutabilität von Sektor + business_type (Stand 0017).** Beide sind nach der Registrierung
> unveränderlich. `tenants` hat eine UPDATE-Policy `tenant_update_own` (schon aus 0001), die 0017 um
> ein `WITH CHECK` erweitert: der Kunde (Rolle `authenticated`) darf `sector` und `business_type`
> NICHT ändern (beide werden per `current_tenant_sector()` / `current_tenant_business_type()` gegen
> den Bestandswert gepinnt). Der Betreiber (`service_role`, BYPASSRLS Admin-Client) umgeht RLS und
> kann weiterhin zuweisen/umstellen — genau die „Betreiber weist zu"-Regel. HINWEIS: Frühere Slices
> ließen `tenant_update_own` OHNE `WITH CHECK` (nur `USING`) — ein Kunde hätte per direktem PostgREST
> theoretisch Spalten seiner eigenen Zeile ändern können; für `sector` fing das der CHECK ab, für
> `business_type` wäre es ein Loch gewesen. 0017 schließt beides. Wer diese Policy künftig anfasst,
> MUSS `sector` + `business_type` im `WITH CHECK` gepinnt lassen.

Die Tupel in `lib/sectors/types.ts` (`SECTOR_TUPLE`, `CAMPAIGN_TYPE_TUPLE`, `FLOW_MODE_TUPLE`)
sind bewusst **breit** geblieben, damit dieser Code weiter kompiliert. Reaktivieren heißt daher:
Registry-Eintrag + CHECK erweitern (+ ggf. RLS-Audit) — keine Typänderungen nötig.

## Rezept — einen deaktivierten Sektor/Modus aktivieren

Beispiel (das verbleibende dormante Ziel): `real_estate` / `property` aktivieren. Zwei bereits
durchgeführte, echte Beispiele dieses Rezepts: `tourism / stay / feedback` (Migration `0009`) und
`event / wedding / guestbook` (Migration `0018`) — beide inklusive Schritt 4, dem B1-Gallery-Audit
via `is_gallery_event`. `0018` ist zusätzlich das Muster, falls der reaktivierte Modus zuvor dormant
war (Gäste-Flow-Zweig + Route-Entsperrung, s. Schritt 5); `property` dagegen nutzt die schon aktiven
Modi `gallery`/`feedback` und braucht diesen Teil nicht.

1. **Migration — CHECK erweitern** (neue Datei `supabase/migrations/00NN_*.sql`, drop + recreate):

   ```sql
   alter table public.tenants drop constraint if exists tenants_sector_check;
   alter table public.tenants add constraint tenants_sector_check
     check (sector in ('tourism', 'event', 'real_estate'));

   alter table public.events drop constraint if exists events_campaign_type_check;
   alter table public.events add constraint events_campaign_type_check
     check (campaign_type in ('agency', 'stay', 'wedding', 'property'));

   -- property nutzt gallery ODER feedback (allowFlowModeChoice) — beide bereits aktiv,
   -- daher KEIN neuer flow_mode-Wert nötig. Nur ein WIRKLICH neuer Modus wird hier ergänzt.
   alter table public.events drop constraint if exists events_flow_mode_check;
   alter table public.events add constraint events_flow_mode_check
     check (flow_mode in ('gallery', 'feedback', 'guestbook'));
   ```

   Danach `npx supabase gen types typescript --local > types/database.ts`.
   Führt die Reaktivierung eine **neue Tabelle** ein: an die GRANTs denken. `0007_grants.sql`
   setzt `alter default privileges`, sodass von Migrationen (als DB-Owner) erstellte Tabellen
   automatisch für `anon`/`authenticated`/`service_role` berechtigt sind. Ohne GRANT scheitert
   der Zugriff mit `42501` (permission denied), bevor RLS greift — RLS-Policy für die neue
   Tabelle ebenfalls nicht vergessen.

2. **Registry — Modul eintragen** (`lib/sectors/index.ts`): das Modul importieren und in
   `SECTORS` + `CAMPAIGN_TYPES` ergänzen (Vorlagen: die bestehenden `tourism`- und `event`-Einträge;
   das `real_estate`-Modul liegt bereits unter `lib/sectors/real_estate/`):

   ```ts
   import { realEstate } from './real_estate'
   // ...
   export const SECTORS: Partial<Record<Sector, SectorConfig>> = {
     // tourism + event sind bereits aktiv …
     real_estate: { label: realEstate.label, campaignTypes: ['property'] },
   }
   export const CAMPAIGN_TYPES: Partial<Record<CampaignType, CampaignTypeConfig>> = {
     // agency, stay, wedding sind bereits aktiv …
     property: realEstate.campaignTypes.property,
   }
   ```

   `resolveFlowMode()` bleibt der einzige Dispatch-Punkt — nichts weiter zu ändern.

3. **Capabilities/Labels prüfen**: für `gallery`/`feedback` (property) — wie für alle drei aktiven
   Modi — bereits in `lib/sectors/types.ts` vorhanden. Ein **neuer** Modus braucht dort je einen
   `FLOW_MODE_CAPABILITIES`- und `FLOW_MODE_LABELS`-Eintrag (und den Wert in `FLOW_MODE_TUPLE`).

4. **Sicherheit — RLS-Audit (PFLICHT bei guest-sichtbaren Daten):** Prüfe, ob der reaktivierte
   Modus Zeilen erzeugt, die über `public_gallery_select` / `public_select_events` an Gäste
   gelangen könnten. Private Feedback-/Gästebuch-Kommentare (`submissions.comment` /
   `guest_name`) dürfen **nicht** öffentlich lesbar sein. Falls nötig, eine `flow_mode`-Bedingung
   in `public_gallery_select` ergänzen — **in derselben Migration** wie Schritt 1 und mit Test
   (siehe Schritt 6, Isolationsprüfung).

5. **Gäste-Flow + Route** — nur, wenn der reaktivierte Modus zuvor **dormant** war. `property` nutzt
   die bereits aktiven Modi `gallery`/`feedback`; Dispatch-Zweig und Route existieren, hier ist NICHTS
   zu tun. War der Modus dagegen dormant (Muster `0018`, `guestbook`), dann:
   - In `app/e/[eventId]/GuestFlow.tsx` den Dispatch-Zweig ergänzen
     (`0018`: `if (flowMode === 'guestbook') return <GuestbookFlow {...rest} />`).
   - Die Route entsperren (`_`-Präfix entfernen), wie `0018` `app/api/events/[eventId]/_guestbook`
     → `.../guestbook`.
     Die Self-Service-Registrierung ist bereits aktiv und sektor-unabhängig; sie muss beim
     Reaktivieren eines Sektors nicht mehr angefasst werden.

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
- **Toter Code `app/api/submissions/[submissionId]/rate/route.ts`:** wird von KEINEM Client
  aufgerufen (grep-verifiziert 2026-08-08; die Gäste-Flows hängen Bewertung/Antworten über
  `/api/events/[eventId]/feedback` an). Seit dem tour→agency-Remodel (0016) ist auch der Kommentar
  in der Route veraltet („tour-only"). **In Phase 6 löschen** — in diesem Slice NICHT angefasst.

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
