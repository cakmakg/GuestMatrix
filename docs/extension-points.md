# Extension Points — einen Sektor / Flow-Modus (wieder) aktivieren

> Zweck: die **schriftliche, geprüfte Anleitung**, wie ein deaktivierter Sektor oder Flow-Modus
> aktiviert wird. Wenn diese Anleitung kurz bleibt und auf vorhandenen Code zeigt, ist die
> Architektur nachweislich erweiterbar — ohne toten Stub-Code und ohne offene Sicherheitsfläche.

## Invariante (aktueller Zustand)

**Aktiv ist ausschließlich `tourism / tour / gallery`.** Die Garantie besteht aus zwei Schichten:

1. **DB-CHECK** (`supabase/migrations/0006_lockdown_tourism_gallery.sql`): `tenants.sector = 'tourism'`,
   `events.campaign_type = 'tour'`, `events.flow_mode = 'gallery'`. Deaktivierte Werte sind
   **nicht speicherbar** — eine `feedback`/`guestbook`- oder Nicht-Tourism-Zeile kann physisch
   nicht existieren.
2. **Registry** (`lib/sectors/index.ts`): nur `tourism`/`tour` sind in `SECTORS` + `CAMPAIGN_TYPES`
   eingetragen. UI, Validierung und Gäste-Flow leiten sich vollständig hieraus ab.

**Wichtig — RLS ist NICHT flow-mode-aware.** Die Policies `public_gallery_select` und
`public_select_events` filtern **nicht** nach `flow_mode`. Deshalb ist der DB-CHECK (nicht eine
RLS-Policy) die Garantie, dass ein deaktivierter Modus keine Zeile hält. Wer einen guest-sichtbaren
Modus reaktiviert, **muss** diese beiden Policies erneut prüfen (siehe Schritt 4).

## Vorhandener Code als Vorlage (dormant, nicht gelöscht)

| Konzept                        | Ort (deaktiviert/dormant)                                             |
| ------------------------------ | --------------------------------------------------------------------- |
| Sektor-Modul `event` (Momento) | `lib/sectors/event/index.ts`                                          |
| Sektor-Modul `real_estate`     | `lib/sectors/real_estate/index.ts`                                    |
| Flow-Modus-Capabilities/Labels | `lib/sectors/types.ts` (`FLOW_MODE_CAPABILITIES`, `FLOW_MODE_LABELS`) |
| Gäste-Flow `feedback`          | `app/e/[eventId]/FeedbackFlow.tsx`                                    |
| Gäste-Flow `guestbook`         | `app/e/[eventId]/GuestbookFlow.tsx`                                   |
| Route Gästebuch-Gruß           | `app/api/events/[eventId]/_guestbook/route.ts`                        |
| Route Feedback                 | `app/api/events/[eventId]/_feedback/route.ts`                         |
| Self-Service-Signup (Momento)  | `app/_signup/` (Route via `_`-Präfix deaktiviert)                     |

Die Tupel in `lib/sectors/types.ts` (`SECTOR_TUPLE`, `CAMPAIGN_TYPE_TUPLE`, `FLOW_MODE_TUPLE`)
sind bewusst **breit** geblieben, damit dieser Code weiter kompiliert. Reaktivieren heißt daher:
Registry-Eintrag + CHECK erweitern (+ ggf. RLS-Audit) — keine Typänderungen nötig.

## Rezept — einen deaktivierten Sektor/Modus aktivieren

Beispiel: `event` / `wedding` / `guestbook` wieder aktivieren.

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
     → `.../guestbook` (bzw. `_feedback` → `feedback`, `app/_signup` → `app/signup` +
     Link/Erfolgsmeldung in `app/login/page.tsx` wiederherstellen).

6. **Tests** — mindestens:
   - `tests/sectors.test.ts`: aktive Registry-Erwartungen anpassen (`Object.keys(SECTORS)`,
     `campaignTypesForSector`, `resolveFlowMode`, `isCampaignType`).
   - Isolationsprüfung (DB): `insert` mit dem neuen Wert **gelingt**; ein weiterhin gesperrter
     Wert **verstößt** gegen den CHECK; Cross-Tenant-Read liefert 0 Zeilen (RLS).
   - Bei Schritt 4: ein guest-sichtbarer Read darf **keinen** privaten `comment`/`guest_name`
     eines fremden `flow_mode` zurückgeben.

## Selbsttest der Architektur

Bleibt dieses Rezept kurz und zeigt es auf vorhandenen Code (`lib/sectors/event/`,
`lib/sectors/real_estate/`), sind die Nahtstellen gut. Wird es lang und verzweigt, sind die
Seams schlecht — und das ist auf dem Papier erkannt, bevor Code für einen zweiten Sektor
geschrieben wird.
