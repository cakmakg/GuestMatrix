import { Fragment, type ReactElement } from 'react'

import { MktIcon } from './icons'

/**
 * Der Nachbau des Dashboards neben dem Ablauf — die Antwort auf „und was sehe ICH dann?".
 *
 * Attrappe wie die Produktkarte im Hero, mit derselben Regel: nichts darin ist bedienbar, und
 * nichts darin zeigt etwas, das es im Produkt nicht gibt. Jede Spalte hier steht so auch in
 * `app/dashboard/events/[eventId]/page.tsx`:
 *
 * - Die drei Kennzahlen sind die einer Feedback-Kampagne (Feedback · Kommentare · Ø Bewertung).
 *   Eine Galerie zählt „Uploads · Sichtbar · Ø Bewertung", ein Gästebuch „Beiträge · Mit
 *   Foto/Video · Sichtbar" — deshalb steht der Kampagnenname darüber und nicht „das Dashboard".
 * - „Gesperrt" ist die echte Marke der Moderation (`moderation_flag`), nicht ein ausgedachter
 *   Freigabe-Zustand. Es gibt keine Warteschlange: ein Beitrag ist sichtbar, bis jemand ihn sperrt.
 * - „Anonym" steht dort, wo ein Gast seinen Namen nicht angegeben hat. Das ist der Normalfall,
 *   kein Fehlzustand — der Name ist überall freiwillig außer im Gästebuch.
 *
 * Aus der Vorlage NICHT übernommen: die Zeile „Letzte Synchronisation: vor 2 Min · via Momento".
 * Es gibt nichts zu synchronisieren; ein Beitrag ist da, sobald der Gast ihn abschickt.
 */
type MockRow = {
  guest: string
  kind: string
  rating: string
  blocked?: boolean
}

const ROWS: readonly MockRow[] = [
  { guest: 'Lena W.', kind: 'Feedback + Foto', rating: '★★★★★' },
  { guest: 'Anonym', kind: 'Feedback', rating: '★★★★☆' },
  { guest: 'Max K.', kind: 'Video', rating: '★★★★★' },
  { guest: 'Julia S.', kind: 'Foto', rating: '—', blocked: true },
]

const STATS: readonly { label: string; value: string; accent: string }[] = [
  { label: 'Feedback', value: '248', accent: 'red' },
  { label: 'Kommentare', value: '96', accent: 'orange' },
  { label: 'Ø Bewertung', value: '4,8', accent: 'green' },
]

export function DashboardMock(): ReactElement {
  return (
    <div className="gs-mkt-mock" aria-hidden="true">
      <div className="gs-mkt-mock-inner">
        <div className="gs-mkt-mock-head">
          <span className="gs-mkt-mock-badge">
            <MktIcon name="window" size={16} bold />
          </span>
          <span className="gs-mkt-mock-title">Hotel Adler · Gäste</span>
          <span className="gs-mkt-mock-type">Hotel / Aufenthalt</span>
        </div>

        <div className="gs-mkt-mock-stats">
          {STATS.map((stat) => (
            <div key={stat.label} className="gs-mkt-mock-stat" data-accent={stat.accent}>
              <span className="gs-mkt-mock-value">{stat.value}</span>
              <span className="gs-mkt-mock-label">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Kein <table>: die Attrappe trägt keine Daten, sie zeigt eine Form. Ein Tabellengerüst
            mit erfundenen Werten wäre für Screenreader eine Tabelle zum Vorlesen — deshalb liegt
            über dem Ganzen aria-hidden und darunter reines Raster. */}
        <div className="gs-mkt-mock-grid">
          <span className="gs-mkt-mock-th">Gast</span>
          <span className="gs-mkt-mock-th">Beitrag</span>
          <span className="gs-mkt-mock-th">Bewertung</span>
          <span className="gs-mkt-mock-th">Status</span>

          {ROWS.map((row) => (
            <Fragment key={row.guest}>
              <span className="gs-mkt-mock-td">{row.guest}</span>
              <span className="gs-mkt-mock-td">{row.kind}</span>
              <span className="gs-mkt-mock-td">{row.rating}</span>
              <span className="gs-mkt-mock-td" data-state={row.blocked ? 'blocked' : 'visible'}>
                {row.blocked ? 'Gesperrt' : 'Sichtbar'}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
