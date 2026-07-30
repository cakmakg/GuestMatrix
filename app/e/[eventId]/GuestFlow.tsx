import type { FlowMode, GuestFlowLabels } from '@/lib/sectors'

import FeedbackFlow from './FeedbackFlow'
import GalleryFlow from './GalleryFlow'

type Props = {
  eventId: string
  eventName: string
  brandName: string | null
  description: string | null
  flowMode: FlowMode
  labels: GuestFlowLabels
}

/**
 * Verteiler für den Gäste-Flow anhand des Flow-Modus.
 *
 * Aktiv (0009): `gallery` (Tour) und `feedback` (Hotel/Aufenthalt). Der Modus `guestbook`
 * bleibt deaktiviert — der DB-CHECK verhindert, dass eine solche Kampagne existiert;
 * `GuestbookFlow` bleibt als Code erhalten (dormant). Zum Reaktivieren hier den Zweig wieder
 * ergänzen — siehe docs/extension-points.md.
 */
export default function GuestFlow({ flowMode, ...rest }: Props) {
  if (flowMode === 'feedback') return <FeedbackFlow {...rest} />
  if (flowMode !== 'gallery') {
    throw new Error(`Flow-Modus '${flowMode}' ist deaktiviert; aktiv sind nur gallery/feedback.`)
  }
  return <GalleryFlow {...rest} />
}
