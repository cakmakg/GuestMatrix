'use server'

import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sectorSchema } from '@/lib/validation/schemas'

export async function updateSectorAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAuth()

  const parsed = sectorSchema.safeParse({ sector: formData.get('sector') })
  if (!parsed.success) {
    const message = encodeURIComponent(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.')
    redirect(`/dashboard/settings?error=${message}`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('tenants')
    .update({ sector: parsed.data.sector })
    .eq('id', tenantId)

  if (error) {
    redirect('/dashboard/settings?error=Fehler+beim+Speichern.')
  }

  redirect('/dashboard/settings?saved=1')
}
