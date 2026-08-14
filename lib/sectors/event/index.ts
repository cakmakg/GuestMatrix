import type { SectorModule } from '../types'

/**
 * Sektor: Hochzeit / Event.
 * Kampagnentyp: Hochzeit/Event (privates Gästebuch — guestbook).
 * Gäste hinterlassen Name + Glückwunsch + Fotos/Videos; sichtbar nur für das Brautpaar.
 * Geteilte Galerie / Live-Fotowand folgt später (dann als gallery-Modus).
 */
export const event = {
  id: 'event',
  label: 'Hochzeit / Event',
  // Kein business_type in diesem Sektor — die Benennung hängt hier am Sektor selbst.
  // Nur die Wörter, die im Gästebuch anders heißen; alles Übrige kommt aus dem Standard.
  // Ein Brautpaar sammelt keine „Rückmeldungen", sondern Glückwünsche.
  dashboardLabels: {
    experiences: 'Feiern',
    experience: 'Feier',
    activeExperiences: 'Aktive Feiern',
    responses: 'Glückwünsche',
    response: 'Glückwunsch',
    media: 'Fotos & Videos',
  },
  // Ein Brautpaar blättert in Erinnerungen, es verwaltet keinen Bestand. Das Album-Thema tauscht
  // dafür nur die Tokens (Papierton, Serifenschrift, weiche Kante) — Panels, Daten und Layout
  // bleiben dieselben wie überall sonst. Siehe DashboardTheme in ../types.
  dashboardTheme: 'album',
  campaignTypes: {
    wedding: {
      sector: 'event',
      label: 'Hochzeit / Event',
      defaultFlowMode: 'guestbook',
      allowFlowModeChoice: false,
      // NOCH NICHT anbieten (bewusst false, nicht entfernt):
      //
      // Die Sichtbarkeitsachse existiert vollständig in der DB (Migration 0021: Spalte, CHECK,
      // `public_guestbook_select`, Proof 11/11). Was fehlt, ist der Bildschirm, auf dem ein Gast
      // die Beiträge der anderen SIEHT — das ist Dilim C und zurückgestellt.
      //
      // Böte man die Wahl trotzdem an, verspräche der Einwilligungstext bei `shared`/`moderated`
      // („ALLEN Gästen dieser Feier gezeigt") etwas, das kein Bildschirm einlöst. Ein Versprechen
      // an den Gast, das die Software nicht hält, ist schlimmer als eine fehlende Option.
      //
      // Wieder aufmachen = diese Zeile auf `true` setzen; Datenpfad und Texte sind fertig.
      allowVisibilityChoice: false,
      labels: {
        landingHeadline: 'Hinterlasst dem Brautpaar eure Glückwünsche und schönsten Fotos!',
        ratingPrompt: 'Wie war die Feier für dich?',
        commentPrompt: 'Eure Glückwünsche',
        commentPlaceholder: 'Schreibt dem Brautpaar ein paar liebe Worte …',
        namePrompt: 'Euer Name',
        namePlaceholder: 'Von wem ist der Gruß?',
      },
      // Optionale, verspielte Kurzfrage (Freitext). Landet generisch in feedback_answers.three_words;
      // der Werttyp (string) wird von Zod, Handler und DB (0019) erzwungen. `id` ist STABIL.
      questions: [
        {
          id: 'three_words',
          prompt: 'Beschreibt die Feier in drei Worten',
          type: 'text',
          maxLength: 60,
        },
      ],
    },
  },
} satisfies SectorModule
