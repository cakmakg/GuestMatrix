import { notFound } from 'next/navigation'

import { displayFont } from '@/lib/fonts'
import { resolveGuestTheme } from '@/lib/sectors'
import type { FlowMode, GuestFlowLabels } from '@/lib/sectors'

import GuestFlow from './GuestFlow'

type PublicEvent = {
  id: string
  name: string
  description: string | null
  brandName: string | null
  campaignType: string
  flowMode: FlowMode
  labels: GuestFlowLabels
}

async function fetchPublicEvent(eventId: string): Promise<PublicEvent | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/events/${eventId}/public`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return (await res.json()) as PublicEvent
  } catch {
    return null
  }
}

export default async function GuestPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const event = await fetchPublicEvent(eventId)

  if (!event) notFound()

  // Erscheinungsbild wie im Dashboard aus der Registry, nicht aus einer Fallunterscheidung — hier
  // aus dem Kampagnentyp, weil gästeseitig kein Tenant angemeldet ist (`resolveGuestTheme`).
  // Die Anzeigeschrift trägt jedes Thema, deshalb steht ihre Variable unbedingt an derselben Stelle.
  return (
    <div
      className={`gs-guest-page ${displayFont.variable}`}
      data-theme={resolveGuestTheme(event.campaignType)}
    >
      <GuestFlow
        eventId={event.id}
        eventName={event.name}
        brandName={event.brandName}
        description={event.description}
        flowMode={event.flowMode}
        labels={event.labels}
      />
    </div>
  )
}
