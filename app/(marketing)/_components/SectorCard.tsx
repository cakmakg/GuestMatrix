import type { ReactElement } from 'react'

import type { SectorCardContent } from '@/lib/marketing/segments'

import { MktIcon } from './icons'
import { QrMock } from './QrMock'

/**
 * Die Produktattrappe im Hero — eine Kampagne, wie der Kunde sie im Produkt sähe.
 *
 * Die Inhalte kommen aus `lib/marketing/segments.ts` und damit aus der Registry; diese Datei
 * kennt nur die Form. Der Wechsler drumherum tritt damit durch alle aktiven Geschäftsarten,
 * ohne dass hier etwas von ihnen weiß.
 *
 * Nichts darin ist bedienbar: die Aktionsfläche ist ein <div>, kein <button>. Eine Attrappe, die
 * im Tastaturfokus auftaucht und dann nichts tut, ist schlimmer als eine, die still bleibt.
 */
export function SectorCard({ content }: { content: SectorCardContent }): ReactElement {
  return (
    <div className="gs-mkt-card" data-accent={content.accent}>
      <div className="gs-mkt-card-head">
        <div>
          <div className="gs-mkt-card-title">{content.title}</div>
          <div className="gs-mkt-card-label">{content.audience}</div>
        </div>
        <div className="gs-mkt-card-icon">
          <MktIcon name={content.icon} size={18} />
        </div>
      </div>

      <p className="gs-mkt-card-hint">{content.qrHint}</p>
      <div className="gs-mkt-qr">
        <QrMock />
      </div>

      <div className="gs-mkt-chips">
        {content.chips.map((chip) => (
          <div key={chip.label} className="gs-mkt-chip">
            <MktIcon name={chip.icon} size={16} />
            <span>{chip.label}</span>
          </div>
        ))}
      </div>

      <div className="gs-mkt-card-cta">
        <MktIcon name="upload" size={18} bold />
        <span>{content.ctaLabel}</span>
      </div>
    </div>
  )
}
