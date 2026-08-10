import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_REFRESH_MS = 60 * 1000 // Aktivitäts-Cookie höchstens 1×/Minute neu schreiben
const LAST_ACTIVE_COOKIE = 'gm_last_active'

const PROTECTED_PREFIXES = ['/dashboard']
const AUTH_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password']

/**
 * @supabase/ssr-Pflicht: Gibt die Middleware statt `supabaseResponse` einen EIGENEN Response
 * (hier: jede Redirect-Antwort) zurück, MÜSSEN die von getUser() ggf. erneuerten Auth-Cookies
 * mitkopiert werden. Sonst geraten Browser und Server aus dem Takt und die Session wird vorzeitig
 * beendet — der Login „klebt" nicht und man landet immer wieder auf /login.
 */
function withSessionCookies(source: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie)
  }
  return target
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // ── 1. General API rate limit (DoS protection) ──────────────────────────────
  if (pathname.startsWith('/api/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1'

    try {
      await checkRateLimit(rateLimiters.api, ip)
    } catch {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        },
      )
    }
  }

  // ── 2. Supabase session refresh ──────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // auth.getUser() MUSS hier aufgerufen werden — damit wird die Token-Erneuerung ausgelöst.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 3. Idle timeout (tenant sessions only, not anonymous guests) ─────────────
  // Den Logout-Endpunkt AUSNEHMEN: sonst trifft die Idle-Weiterleitung auch
  // /api/auth/logout selbst und der Request erreicht nie den Handler, der die Session
  // löscht — die Middleware leitet ihn immer wieder auf /api/auth/logout um
  // (Redirect-Schleife, die getUser() flutet und in ein Auth-Rate-Limit 429 kippt).
  //
  // Prefetch-Requests AUSNEHMEN: sie sind spekulativ, keine echte Nutzeraktivität — sie dürfen
  // den Idle-Timer nicht zurücksetzen und keine Logout-Weiterleitung auslösen. Vor allem aber
  // würde ein bei jedem (Pre)fetch mitgesendetes, sich änderndes Set-Cookie (gm_last_active)
  // den App-Router-Cache verwerfen und endlose Nachlade-Schleifen erzeugen (GET /dashboard …).
  const isLogoutRoute = pathname.startsWith('/api/auth/logout')
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch'
  if (user && !user.is_anonymous && !isLogoutRoute && !isPrefetch) {
    const lastActiveRaw = request.cookies.get(LAST_ACTIVE_COOKIE)?.value
    const lastActive = lastActiveRaw ? parseInt(lastActiveRaw, 10) : null
    const now = Date.now()

    if (lastActive !== null && now - lastActive > IDLE_TIMEOUT_MS) {
      // Session expired due to inactivity — redirect to a logout handler
      const url = request.nextUrl.clone()
      url.pathname = '/api/auth/logout'
      url.searchParams.set('reason', 'idle_timeout')
      url.searchParams.set('next', '/login')
      return withSessionCookies(supabaseResponse, NextResponse.redirect(url))
    }

    // Cookie nur setzen, wenn es sich wirklich ändert (max. 1×/Minute). Ein bei JEDEM Request
    // neu geschriebenes Set-Cookie würde den Router-Cache thrashen und die Nachlade-Schleife
    // selbst dann auslösen, wenn der Request kein Prefetch ist.
    if (lastActive === null || now - lastActive > ACTIVITY_REFRESH_MS) {
      supabaseResponse.cookies.set(LAST_ACTIVE_COOKIE, String(now), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }
  }

  // ── 4. Protected route guard ─────────────────────────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (isProtected && (!user || user.is_anonymous)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return withSessionCookies(supabaseResponse, NextResponse.redirect(url))
  }

  // ── 5. Redirect authenticated tenants away from auth pages ──────────────────
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p))
  if (isAuthPage && user && !user.is_anonymous) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return withSessionCookies(supabaseResponse, NextResponse.redirect(url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Alle Pfade außer statischen Dateien und internen _next-Routen
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
