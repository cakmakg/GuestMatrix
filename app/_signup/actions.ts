'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { logger } from '@/lib/logger'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signupSchema } from '@/lib/validation/schemas'

export async function signupAction(formData: FormData): Promise<never> {
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    '127.0.0.1'

  // Rate Limiting: 5 Registrierungen / Stunde pro IP
  try {
    await checkRateLimit(rateLimiters.signup, ip)
  } catch {
    redirect('/signup?error=rate_limited')
  }

  // Eingabe-Validierung
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    brandName: formData.get('brandName'),
  })

  if (!parsed.success) {
    redirect('/signup?error=invalid')
  }

  const { email, password, brandName } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error || !data.user) {
    // Generische Meldung — nie verraten, ob die E-Mail bereits existiert.
    logger.warn('[auth] signup_failed', { ip, code: error?.code })
    redirect('/signup?error=invalid')
  }

  // Supabase gibt bei bereits registrierter E-Mail (Enumeration-Schutz) einen Nutzer
  // mit leerem identities-Array zurück. Dann NICHT erneut einen Tenant anlegen.
  const alreadyRegistered = (data.user.identities?.length ?? 0) === 0
  if (!alreadyRegistered) {
    // Tenant privilegiert anlegen: Sektor fest auf 'event', Kunde wählt keinen Sektor.
    const { error: tenantError } = await supabaseAdmin.from('tenants').insert({
      user_id: data.user.id,
      name: brandName,
      brand_name: brandName,
      sector: 'event',
    })

    if (tenantError) {
      // Kein verwaister Auth-Nutzer ohne Tenant zurücklassen.
      logger.error('[auth] signup_tenant_insert_failed', { ip, code: tenantError.code })
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
      redirect('/signup?error=server')
    }
  }

  // Erfolg (oder bereits registriert): generisch zur Anmeldung leiten.
  redirect('/login?message=signup-success')
}
