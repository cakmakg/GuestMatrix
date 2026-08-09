'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getSignupOption } from '@/lib/sectors'
import { logger } from '@/lib/logger'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
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
    signupChoice: formData.get('signupChoice'),
  })

  if (!parsed.success) {
    redirect('/signup?error=invalid')
  }

  const { email, password, brandName, signupChoice } = parsed.data

  // Server-seitige Autorität: die Wahl in (sector, business_type) auflösen — nicht dem Client
  // ein sector/business_type-Paar glauben. isSignupChoice hat den Wert bereits abgesichert.
  const option = getSignupOption(signupChoice)
  if (!option) {
    redirect('/signup?error=invalid')
  }

  const supabase = await createSupabaseServerClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // brand_name + der abgeleitete sector/business_type reisen in raw_user_meta_data mit; der
  // DB-Trigger handle_new_user (0017) legt daraus atomar den Tenant an (plan='free') und validiert
  // sector + business_type per Allowlist + CHECK. Kein Admin-Insert und kein deleteUser-Cleanup:
  // schlägt der Trigger fehl (Müll-/deaktivierte Wahl), rollt der Auth-Insert in derselben
  // Transaktion zurück — es bleibt kein verwaister Nutzer ohne Tenant.
  // emailRedirectTo greift nur bei aktiver E-Mail-Bestätigung; der Bestätigungslink führt
  // danach zu /login?message=confirmed (ein auth/callback-Handler folgt später).
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        brand_name: brandName,
        sector: option.sector,
        ...(option.businessType ? { business_type: option.businessType } : {}),
      },
      emailRedirectTo: `${appUrl}/login?message=confirmed`,
    },
  })

  if (error) {
    // Generische Meldung — nie verraten, ob die E-Mail bereits existiert.
    logger.warn('[auth] signup_failed', { ip, code: error.code })
    redirect('/signup?error=invalid')
  }

  // Erfolg (oder bereits registriert → Enumeration-Schutz liefert keinen Fehler):
  // generisch zur Anmeldung leiten.
  redirect('/login?message=signup-success')
}
