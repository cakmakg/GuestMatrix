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

/** Wählt den Gäste-Flow anhand des Flow-Modus der Kampagne. */
export default function GuestFlow({ flowMode, ...rest }: Props) {
  if (flowMode === 'feedback') return <FeedbackFlow {...rest} />
  return <GalleryFlow {...rest} />
}
