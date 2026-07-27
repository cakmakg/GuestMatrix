import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SECTORS, campaignTypesForSector, getCampaignConfig, isSector } from '@/lib/sectors'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
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

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Übersicht
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Einstellungen</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Branche</p>
          <p className="text-xs text-gray-400 mb-3">
            Deine Branche wird von uns zugewiesen und bestimmt, welche Kampagnentypen du anlegen
            kannst. Zum Ändern wende dich bitte an den Support.
          </p>

          {sector ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-gray-900">{SECTORS[sector].label}</p>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Verfügbare Kampagnentypen</p>
                <div className="flex flex-wrap gap-2">
                  {campaignTypesForSector(sector).map((type) => (
                    <span
                      key={type}
                      className="inline-block px-2.5 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700"
                    >
                      {getCampaignConfig(type).label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-600">
              Keine Branche zugewiesen. Bitte kontaktiere den Support.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
