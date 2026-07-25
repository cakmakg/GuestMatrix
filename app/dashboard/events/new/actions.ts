'use server'

import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createEventSchema } from '@/lib/validation/schemas'

export async function createEventAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAuth()

  const parsed = createEventSchema.safeParse({
    name: formData.get('name'),
    date: formData.get('date'),
    description: formData.get('description') || undefined,
  })

  if (!parsed.success) {
    const message = encodeURIComponent(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.')
    redirect(`/dashboard/events/new?error=${message}`)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('events')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      date: parsed.data.date,
      description: parsed.data.description ?? null,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !data) {
    redirect('/dashboard/events/new?error=Fehler+beim+Erstellen+des+Events.')
  }

  redirect(`/dashboard/events/${data.id}?created=1`)
}
