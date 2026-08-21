import type { ReactElement, ReactNode } from 'react'

/**
 * Das Telefon-Gehäuse — Gerüst für BEIDE Attrappen der Seite.
 *
 * Im Hero steckt darin der Gäste-Ablauf (`GuestPhone`), bei „Warum Momento" die Sicht des
 * Betriebs (`DashboardPhone`). Gemeinsam sind nur Rahmen, Kerbe, Statuszeile und Kopf; alles
 * darunter kommt als `children` herein.
 *
 * `aria-hidden` liegt HIER und nicht in den Inhalten: eine Attrappe zeigt eine Form, sie trägt
 * keine Daten. Ein Screenreader, der „248 Fotos" vorliest, verwechselt Werbebild mit Wahrheit.
 * Unbedenklich, weil darin nichts fokussierbar ist — es gibt keine Knöpfe und keine Links.
 */
type Props = {
  /** Kampagnenname im Telefonkopf — kommt aus der Registry, nicht aus diesem Bauteil. */
  title: string
  children: ReactNode
}

export function PhoneFrame({ title, children }: Props): ReactElement {
  return (
    <div className="gs-mkt-phone" aria-hidden="true">
      <div className="gs-mkt-phone-screen">
        <div className="gs-mkt-phone-status">
          <span>9:41</span>
          <span>
            {/* Die Empfangsbalken sind gefüllt, nicht gestrichen — deshalb hier als eigenes
                <svg> und nicht über MktIcon, das auf `fill: none` steht. */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor" aria-hidden="true">
              <rect x="0" y="6" width="2" height="4" />
              <rect x="4" y="4" width="2" height="6" />
              <rect x="8" y="2" width="2" height="8" />
              <rect x="12" y="0" width="2" height="10" />
            </svg>
            100%
          </span>
        </div>

        <div className="gs-mkt-phone-head">
          <span className="gs-mkt-phone-title">{title}</span>
          <span className="gs-mkt-phone-avatar">M</span>
        </div>

        <div className="gs-mkt-phone-stage">{children}</div>
      </div>
    </div>
  )
}
