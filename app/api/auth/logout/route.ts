import { type NextRequest, NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

// Wird auf zwei Wegen aufgerufen:
//   - GET: Idle-Timeout-Weiterleitung aus der Middleware.
//   - POST: der „Abmelden"-Button im Dashboard-Layout (<form method="POST">).
// 303 (See Other) erzwingt, dass der Browser das Ziel per GET lädt — sonst würde ein POST
// per 307 auf /login re-gepostet und liefe dort ins Leere (Seite hat keinen POST-Handler).
async function handleLogout(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  const reason = request.nextUrl.searchParams.get('reason')
  const next = request.nextUrl.searchParams.get('next') ?? '/login'

  const url = request.nextUrl.clone()
  url.pathname = next
  url.search = ''
  if (reason) url.searchParams.set('reason', reason)

  const response = NextResponse.redirect(url, 303)
  // Mit explizitem path='/' entfernen — exakt wie die Middleware das Cookie setzt. Ein delete()
  // ohne path matcht das path='/'-Cookie nicht; ein veraltetes gm_last_active bliebe zurück und
  // löste nach dem nächsten Login sofort wieder einen Idle-Logout aus.
  response.cookies.set('gm_last_active', '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleLogout(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleLogout(request)
}
