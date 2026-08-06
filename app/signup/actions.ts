'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

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
    sector: formData.get('sector'),
  })

  if (!parsed.success) {
    redirect('/signup?error=invalid')
  }

  const { email, password, brandName, sector } = parsed.data

  const supabase = await createSupabaseServerClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // brand_name und der bei der Registrierung gewählte sector reisen in raw_user_meta_data mit;
  // der DB-Trigger handle_new_user (0015) legt daraus atomar den Tenant an (plan='free') und
  // validiert den Sektor per Allowlist + CHECK. Kein Admin-Insert und kein deleteUser-Cleanup:
  // schlägt der Trigger fehl (Müll-/deaktivierter Sektor), rollt der Auth-Insert in derselben
  // Transaktion zurück — es bleibt kein verwaister Nutzer ohne Tenant.
  // emailRedirectTo greift nur bei aktiver E-Mail-Bestätigung; der Bestätigungslink führt
  // danach zu /login?message=confirmed (ein auth/callback-Handler folgt später).
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { brand_name: brandName, sector },
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
