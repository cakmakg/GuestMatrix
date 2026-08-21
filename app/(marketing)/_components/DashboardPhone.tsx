import type { ReactElement } from 'react'

import { MktIcon } from './icons'
import { PhoneFrame } from './PhoneFrame'

/**
 * Die Sicht des BETRIEBS — die Antwort auf „und was sehe ich dann?".
 *
 * Nachfolger von `DashboardMock` aus der vorigen Fassung, mit denselben Regeln: nichts darin ist
 * bedienbar, und nichts darin zeigt etwas, das es im Produkt nicht gibt.
 *
 * Die drei Kennzahlen sind die einer FEEDBACK-Kampagne (Feedback · Kommentare · Ø Bewertung),
 * weil das Telefon eine Hotel-Kampagne zeigt. Eine Galerie zählt „Uploads · Sichtbar ·
 * Ø Bewertung", ein Gästebuch „Beiträge · Mit Foto/Video · Sichtbar" — deshalb steht der
 * Kampagnenname im Telefonkopf und nicht „das Dashboard". Die Vorlage zählte hier „Fotos ·
 * Videos · Ø Rating"; Medienarten sind im Panel keine Kennzahl.
 *
 * Aus der Vorlage NICHT übernommen: die Sprechblase „Neu geteilt — Marie hat 3 Fotos geteilt"
 * war als Push-Meldung gezeichnet. Es gibt keine Benachrichtigungen; ein Beitrag ist einfach da,
 * sobald der Gast ihn abschickt. Deshalb steht dort jetzt der Vorgang und nicht die Meldung.
 */
type Kpi = { value: string; label: string }

const KPIS: readonly Kpi[] = [
  { value: '248', label: 'Feedback' },
  { value: '96', label: 'Kommentare' },
  { value: '4,8', label: 'Ø Bewertung' },
]

/**
 * Neun Kacheln, eine davon als Video markiert — dieselbe Mischung wie in einer echten Liste.
 *
 * Die Zahl ist nicht beliebig: das Gehäuse hat das Seitenverhältnis 9/19, und mit sechs Kacheln
 * blieb unter der Rezension ein handbreiter leerer Streifen stehen. Ein Bildschirm, der unten
 * ausläuft, sieht nach halb geladen aus.
 */
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const
const VIDEO_CELL = 4

export function DashboardPhone({ title }: { title: string }): ReactElement {
  return (
    <PhoneFrame title={title}>
      <div className="gs-mkt-dash">
        <div className="gs-mkt-dash-kpis">
          {KPIS.map((kpi) => (
            <div key={kpi.label} className="gs-mkt-dash-kpi">
              <span className="gs-mkt-dash-value">{kpi.value}</span>
              <span className="gs-mkt-dash-label">{kpi.label}</span>
            </div>
          ))}
        </div>

        <div className="gs-mkt-dash-row">
          <span className="gs-mkt-dash-heading">Neueste Beiträge</span>
          <span className="gs-mkt-dash-live">Live</span>
        </div>

        <div className="gs-mkt-dash-grid">
          {CELLS.map((cell) => (
            <div key={cell} className="gs-mkt-dash-cell">
              {cell === VIDEO_CELL && (
                // Gefülltes Dreieck statt Strichzeichnung — deshalb hier direkt und nicht
                // über MktIcon, das auf `fill: none` steht.
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <polygon points="8 5 19 12 8 19 8 5" />
                </svg>
              )}
            </div>
          ))}
        </div>

        <div className="gs-mkt-dash-review">
          <div className="gs-mkt-dash-review-head">
            <span className="gs-mkt-dash-guest">
              <span className="gs-mkt-dash-avatar">L</span>
              Lena W.
            </span>
            <span className="gs-mkt-dash-stars">★★★★★</span>
          </div>
          <p className="gs-mkt-dash-quote">
            &bdquo;Traumhafter Aufenthalt — kommen bestimmt wieder.&ldquo;
          </p>
        </div>
      </div>
    </PhoneFrame>
  )
}

/**
 * Die beiden Kärtchen, die neben der Attrappe schweben. Sie stehen bewusst AUSSERHALB des
 * Telefons: sie gehören zur Bildkomposition, nicht zum nachgebauten Bildschirm.
 *
 * Unter 900px blendet globals.css sie aus — dort steht das Telefon fast randbündig, und ein
 * überlappendes Kärtchen verdeckt genau die Zahlen, für die es wirbt.
 */
export function DashboardFloats(): ReactElement {
  return (
    <>
      <div className="gs-mkt-float" data-place="top-left" aria-hidden="true">
        <div className="gs-mkt-float-head">
          Diese Woche
          <MktIcon name="trend" size={14} />
        </div>
        <div className="gs-mkt-float-value">+142</div>
        <p className="gs-mkt-float-note">neue Beiträge</p>
      </div>

      <div className="gs-mkt-float" data-place="bottom-right" data-tone="ink" aria-hidden="true">
        <span className="gs-mkt-float-mark">
          <MktIcon name="upload" size={16} bold />
        </span>
        <div>
          <div className="gs-mkt-float-head">Gerade eingegangen</div>
          <p className="gs-mkt-float-note">3 Fotos einer Gästin</p>
        </div>
      </div>
    </>
  )
}
