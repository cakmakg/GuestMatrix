import { type NextRequest, NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  const reason = request.nextUrl.searchParams.get('reason')
  const next = request.nextUrl.searchParams.get('next') ?? '/login'

  const url = request.nextUrl.clone()
  url.pathname = next
  url.search = ''
  if (reason) url.searchParams.set('reason', reason)

  const response = NextResponse.redirect(url)
  response.cookies.delete('gm_last_active')
  return response
}
