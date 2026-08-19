import type { ReactElement } from 'react'

import type { IconName } from '@/lib/marketing/icons'

import { MktIcon } from '../_components/icons'

/**
 * Die schmale Leiste unter dem Hero: vier Aussagen, die alle heute stimmen.
 *
 * Aus der Vorlage übernommen bis auf eine Änderung — dort hieß die vierte Kachel an anderer
 * Stelle „Ein Dashboard für dein ganzes Team". Ein Tenant ist heute genau EIN Auth-Nutzer
 * (`docs/vision.md`, Punkt C2); eine Team-Aussage wäre also falsch. „Ein Dashboard" allein
 * stimmt und sagt dasselbe über den Nutzen.
 */
const FEATURES: readonly { icon: IconName; label: string; accent: string }[] = [
  { icon: 'phone', label: 'Ohne App', accent: 'green' },
  { icon: 'shield', label: 'DSGVO-konform', accent: 'red' },
  { icon: 'bolt', label: 'In Minuten startklar', accent: 'orange' },
  { icon: 'window', label: 'Ein Dashboard', accent: 'yellow' },
]

export function FeatureStrip(): ReactElement {
  return (
    <div className="gs-mkt-strip">
      <div className="gs-mkt-shell">
        <ul className="gs-mkt-strip-inner">
          {FEATURES.map((feature) => (
            <li key={feature.label} className="gs-mkt-strip-item" data-accent={feature.accent}>
              <MktIcon name={feature.icon} size={24} bold />
              <span>{feature.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
