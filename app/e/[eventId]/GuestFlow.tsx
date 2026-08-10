import type { FlowMode, GuestFlowLabels } from '@/lib/sectors'

import FeedbackFlow from './FeedbackFlow'
import GalleryFlow from './GalleryFlow'
import GuestbookFlow from './GuestbookFlow'

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
 * Aktiv: `gallery` (Reiseagentur), `feedback` (Hotel/Aufenthalt, 0009) und `guestbook`
 * (Hochzeit/Event, 0018). Der DB-CHECK stellt sicher, dass nur diese Modi als Kampagne
 * existieren; ein unbekannter Wert ist ein Programmierfehler und wirft. Neue Modi werden über
 * die Registry aktiviert — siehe docs/extension-points.md.
 */
export default function GuestFlow({ flowMode, ...rest }: Props) {
  if (flowMode === 'feedback') return <FeedbackFlow {...rest} />
  if (flowMode === 'guestbook') return <GuestbookFlow {...rest} />
  if (flowMode !== 'gallery') {
    throw new Error(
      `Flow-Modus '${flowMode}' ist unbekannt; aktiv sind gallery/feedback/guestbook.`,
    )
  }
  return <GalleryFlow {...rest} />
}
