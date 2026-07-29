import type { FlowMode, GuestFlowLabels } from '@/lib/sectors'

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
 * Retrenchment (Migration 0006): Aktiv ist ausschließlich der `gallery`-Flow. Die Modi
 * `feedback` und `guestbook` sind deaktiviert — der DB-CHECK verhindert, dass eine solche
 * Kampagne überhaupt existiert. `FeedbackFlow`/`GuestbookFlow` bleiben als Code erhalten
 * (dormant). Zum Reaktivieren hier den jeweiligen Zweig wieder ergänzen — siehe
 * docs/extension-points.md.
 */
export default function GuestFlow({ flowMode, ...rest }: Props) {
  if (flowMode !== 'gallery') {
    throw new Error(`Flow-Modus '${flowMode}' ist deaktiviert; nur 'gallery' ist aktiv.`)
  }
  return <GalleryFlow {...rest} />
}
