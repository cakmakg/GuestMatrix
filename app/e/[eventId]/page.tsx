import { notFound } from 'next/navigation'

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

  return (
    <GuestFlow
      eventId={event.id}
      eventName={event.name}
      brandName={event.brandName}
      description={event.description}
      flowMode={event.flowMode}
      labels={event.labels}
    />
  )
}
