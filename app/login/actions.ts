'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { logger } from '@/lib/logger'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validation/schemas'

export async function loginAction(formData: FormData): Promise<never> {
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    '127.0.0.1'

  // Rate Limiting: 5 Versuche / 15 Minuten pro IP
  try {
    await checkRateLimit(rateLimiters.login, ip)
  } catch {
    redirect('/login?error=rate_limited')
  }

  // Eingabe-Validierung
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    redirect('/login?error=invalid_credentials')
  }

  // Authentifizierung
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Immer generische Fehlermeldung — nie verraten ob E-Mail oder Passwort falsch ist
    logger.warn('[auth] login_failed', { ip, code: error.code })
    redirect('/login?error=invalid_credentials')
  }

  // Open-Redirect-Schutz: nur interne Pfade erlaubt
  const next = String(formData.get('next') ?? '/dashboard')
  const safePath = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  redirect(safePath)
}
