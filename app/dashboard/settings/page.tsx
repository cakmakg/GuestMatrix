import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SECTORS, SECTOR_TUPLE, isSector } from '@/lib/campaigns/config'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { updateSectorAction } from './actions'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { error, saved } = await searchParams

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

  const currentSector = tenant && isSector(tenant.sector) ? tenant.sector : null

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Übersicht
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Einstellungen</h1>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✅ Gespeichert.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      <form
        action={updateSectorAction}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      >
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Branche</p>
          <p className="text-xs text-gray-400 mb-3">
            Bestimmt, welche Kampagnentypen du anlegen kannst. Bestehende Kampagnen bleiben
            unverändert.
          </p>

          <div className="space-y-2">
            {SECTOR_TUPLE.map((sector) => (
              <label
                key={sector}
                className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3
                           cursor-pointer hover:border-indigo-400 transition-colors"
              >
                <input
                  type="radio"
                  name="sector"
                  value={sector}
                  defaultChecked={currentSector === sector}
                  required
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-gray-800">{SECTORS[sector].label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg
                     hover:bg-indigo-700 transition-colors"
        >
          Speichern
        </button>
      </form>
    </div>
  )
}
