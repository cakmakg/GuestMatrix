import Link from 'next/link'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'

import { requireTenantAuth } from '@/lib/auth/session'
import { resolveDashboardCapabilities, resolveDashboardLabels } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import QrSection from '../events/[eventId]/QrSection'

type TenantRow = { sector: string; business_type: string | null }
type EventRow = { id: string; name: string; date: string }

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

/**
 * Der QR-Code als eigener Bildschirm — nur für Sammel-Flows (`contributionCentric`).
 *
 * Dort ist er die häufigste Handlung überhaupt: er steht auf den Tischen, wird ausgedruckt,
 * herumgezeigt und verschickt. Im Betriebs-Flow (Hotel/Agentur) wird er einmal eingerichtet und
 * danach nicht mehr angefasst — deshalb liegt er dort weiterhin auf der Kampagnen-Detailseite
 * und diese Route leitet um, statt einen Bildschirm ohne Anlass anzubieten.
 */
export default async function QrPage() {
  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const supabase = await createSupabaseServerClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type')
    .single<TenantRow>()

  const can = resolveDashboardCapabilities(tenant?.sector, tenant?.business_type)
  if (!can.contributionCentric) redirect('/dashboard')

  const labels = resolveDashboardLabels(tenant?.sector, tenant?.business_type)

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name, date')
    .eq('tenant_id', tenantId)
    .is('archived_at', null)
    .order('date', { ascending: false })

  const events = (eventsData as EventRow[]) ?? []

  if (events.length === 0) {
    return (
      <div className="gs-page">
        <div className="gs-page-head gs-rise" data-i="0">
          <div>
            <div className="gs-kicker">QR-Code</div>
            <h1>Noch nichts zu teilen</h1>
            <div className="gs-page-lead">
              Sobald du eine {labels.experience} angelegt hast, findest du hier den Code für die
              Tische deiner Gäste.
            </div>
          </div>
          <Link className="btn btn-primary" href="/dashboard/events/new">
            {labels.experience} anlegen
          </Link>
        </div>
      </div>
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const codes = await Promise.all(
    events.map(async (event) => ({
      event,
      guestUrl: `${baseUrl}/e/${event.id}`,
      qrDataUrl: await QRCode.toDataURL(`${baseUrl}/e/${event.id}`, { width: 600, margin: 2 }),
    })),
  )

  return (
    <div className="gs-page">
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <div className="gs-kicker">QR-Code</div>
          <h1>Für deine Gäste</h1>
          <div className="gs-page-lead">
            Diesen Code scannen deine Gäste mit dem Telefon — ohne App, ohne Anmeldung.
          </div>
        </div>
      </div>

      {codes.map(({ event, guestUrl, qrDataUrl }, index) => (
        <section
          key={event.id}
          className="gs-rise"
          data-i={index + 1}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Bei mehreren laufenden Kampagnen muss erkennbar bleiben, zu welcher der Code gehört. */}
          {codes.length > 1 && (
            <h2
              style={{ font: 'var(--font-heading-weight) 20px/1.2 var(--font-heading)', margin: 0 }}
            >
              {event.name}
            </h2>
          )}
          <QrSection qrDataUrl={qrDataUrl} guestUrl={guestUrl} />
        </section>
      ))}

      <section className="gs-panel gs-rise" data-i={codes.length + 1}>
        <h3 style={{ fontSize: 20, margin: 0 }}>So funktioniert&apos;s</h3>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
          <li>Code herunterladen und ausdrucken — je Tisch ein Blatt.</li>
          <li>Gäste scannen ihn mit der Kamera; es öffnet sich eine Seite im Browser.</li>
          <li>
            Sie hinterlassen Namen, Glückwunsch und Fotos. Alles landet sofort in deinem Dashboard.
          </li>
        </ol>
        <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
          Die Beiträge sehen nur du und die Person, die sie hinterlassen hat.
        </p>
      </section>
    </div>
  )
}
