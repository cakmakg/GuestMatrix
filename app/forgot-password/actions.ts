'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { forgotPasswordSchema } from '@/lib/validation/schemas'

export async function forgotPasswordAction(formData: FormData): Promise<never> {
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    '127.0.0.1'

  // Rate Limiting: 3 Anfragen / Stunde pro IP (Enumeration-Schutz)
  try {
    await checkRateLimit(rateLimiters.forgotPassword, ip)
  } catch {
    // Bei Rate Limit trotzdem Success zeigen — Timing-Angriff vermeiden
    redirect('/forgot-password?sent=1')
  }

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })

  if (parsed.success) {
    const supabase = await createSupabaseServerClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    // Fehler werden bewusst ignoriert — nie verraten ob eine E-Mail registriert ist
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appUrl}/reset-password`,
    })
  }

  // Immer dieselbe Antwort, unabhängig davon ob E-Mail existiert oder nicht
  redirect('/forgot-password?sent=1')
}
