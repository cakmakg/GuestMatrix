import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  CAMPAIGN_TYPES,
  SECTORS,
  campaignTypesForSector,
  getCampaignConfig,
  isSector,
} from '@/lib/sectors'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { createEventAction } from './actions'

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const today = new Date().toISOString().split('T')[0]

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
    .select('sector')
    .eq('id', tenantId)
    .single<{ sector: string }>()

  const sector = tenant && isSector(tenant.sector) ? tenant.sector : null

  // Branche wird vom Betreiber zugewiesen (kein Self-Service). Fehlt sie, zeigt die
  // Einstellungsseite den Hinweis zum Support-Kontakt.
  if (!sector) {
    redirect('/dashboard/settings')
  }

  const types = campaignTypesForSector(sector)
  const singleType = types.length === 1 ? types[0] : null
  // Flow-Modus-Wahl nur, wenn der (einzige) Typ sie erlaubt (aktuell: Immobilie).
  const flowChoiceType =
    singleType && getCampaignConfig(singleType).allowFlowModeChoice ? singleType : null

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Zurück
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Neue Kampagne erstellen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Branche: {SECTORS[sector].label}</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      <form
        action={createEventAction}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      >
        {/* Kampagnentyp */}
        {singleType ? (
          <input type="hidden" name="campaignType" value={singleType} />
        ) : (
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1.5">
              Kampagnentyp <span className="text-red-500">*</span>
            </p>
            <div className="space-y-2">
              {types.map((type, index) => (
                <label
                  key={type}
                  className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3
                             cursor-pointer hover:border-indigo-400 transition-colors"
                >
                  <input
                    type="radio"
                    name="campaignType"
                    value={type}
                    defaultChecked={index === 0}
                    required
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-sm text-gray-800">{CAMPAIGN_TYPES[type].label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Flow-Modus (nur bei Typen mit Wahlmöglichkeit) */}
        {flowChoiceType && (
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1.5">Ablauf</p>
            <div className="space-y-2">
              <label
                className="flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3
                           cursor-pointer hover:border-indigo-400 transition-colors"
              >
                <input
                  type="radio"
                  name="flowMode"
                  value="feedback"
                  defaultChecked
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-gray-800">
                  Feedback
                  <span className="block text-xs text-gray-400">
                    Bewertung &amp; Kommentar, privat an dich
                  </span>
                </span>
              </label>
              <label
                className="flex items-start gap-3 border border-gray-200 rounded-lg px-4 py-3
                           cursor-pointer hover:border-indigo-400 transition-colors"
              >
                <input
                  type="radio"
                  name="flowMode"
                  value="gallery"
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-gray-800">
                  Galerie
                  <span className="block text-xs text-gray-400">
                    Gäste teilen Fotos/Videos in einer Galerie
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="z. B. Altstadt-Tour · Juni 2026"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Datum <span className="text-red-500">*</span>
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={today}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
            Beschreibung
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            placeholder="Kurze Beschreibung für deine Gäste (optional)"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg
                     hover:bg-indigo-700 transition-colors"
        >
          Kampagne erstellen
        </button>
      </form>
    </div>
  )
}
