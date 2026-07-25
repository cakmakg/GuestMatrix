'use server'

import { redirect } from 'next/navigation'

import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resetPasswordSchema } from '@/lib/validation/schemas'

export async function resetPasswordAction(formData: FormData): Promise<never> {
  const code = String(formData.get('code') ?? '').trim()

  if (!code) {
    redirect('/reset-password?error=invalid_link')
  }

  // Passwort-Validierung (inkl. Bestätigung)
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.'
    redirect(
      `/reset-password?code=${encodeURIComponent(code)}&error=validation&message=${encodeURIComponent(message)}`,
    )
  }

  const supabase = await createSupabaseServerClient()

  // PKCE-Code gegen Session tauschen (Code wird dadurch einmalig konsumiert)
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    logger.warn('[auth] reset_code_exchange_failed', { code: exchangeError.code })
    redirect('/reset-password?error=invalid_link')
  }

  // Neues Passwort setzen
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (updateError) {
    logger.error('[auth] password_update_failed', { code: updateError.code })
    redirect('/reset-password?error=update_failed')
  }

  // Recovery-Session invalidieren — Benutzer muss sich neu anmelden
  await supabase.auth.signOut()

  redirect('/login?message=password-reset-success')
}
