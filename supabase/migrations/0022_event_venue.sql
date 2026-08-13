-- 0022_event_venue.sql
-- Ort einer Kampagne (`events.venue`) — die zweite Zeile unter dem Namen auf der Übersicht.
--
-- Bisher trug eine Kampagne nur Name + Datum. Auf der Ein-Kampagnen-Übersicht (Telefon) steht der
-- Name groß und darunter eine Meta-Zeile; ohne Ort bliebe dort nur das Datum. Der Ort ist für alle
-- drei Geschäftsmodelle sinnvoll und deshalb ein gewöhnliches Feld, kein Sonderfall:
--   Hochzeit → „Villa Sole, İzmir"   Agentur → Reiseziel   Hotel → Haus/Filiale
--
-- Bewusst NUR diese eine Spalte: die „Begrüßung", die im Entwurf daneben steht, existiert bereits
-- als `events.description` und wird dem Gast schon heute angezeigt
-- (app/api/events/[eventId]/public/route.ts). Eine zweite Spalte mit derselben Bedeutung wäre eine
-- Quelle für Widersprüche.
--
-- Nullable und ohne Default: ein Ort ist optional, und Bestandszeilen sollen nicht so tun, als
-- hätten sie einen. Keine RLS-Änderung nötig — `tenant_update_own_events` (0017/0021) deckt UPDATE
-- auf eigene Zeilen bereits ab, und ihr WITH CHECK erzwingt weiterhin, dass `visibility` dabei
-- unverändert bleibt (0021).
--
-- Voraussetzung: 0001..0021. Idempotent (add column if not exists).

alter table public.events add column if not exists venue text;

comment on column public.events.venue is
  'Optionaler Ort der Kampagne (Hochzeit: Location, Agentur: Reiseziel, Hotel: Haus). Wird auf der Übersicht unter dem Namen gezeigt.';
