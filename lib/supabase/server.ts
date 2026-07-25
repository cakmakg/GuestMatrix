import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/types/database'

/**
 * SERVER CLIENT
 *
 * Verwendung: Server-Komponenten, Server-Actions, Route-Handler.
 * - Arbeitet mit dem Anon-Key → RLS-Richtlinien werden VOLLSTÄNDIG angewendet.
 * - Liest und erneuert die Benutzersitzung aus dem Request-Cookie.
 * - Erstellt bei jedem Aufruf eine neue Instanz (kompatibel mit dem Next.js Request-Scope).
 * - Cookies können aus Server-Komponenten nicht gesetzt werden; das Middleware erledigt dies bereits.
 *
 * Beispiel (Server-Komponente oder Route-Handler):
 *   const supabase = await createSupabaseServerClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Der set-Aufruf aus einer Server-Komponente wirft einen Fehler.
            // Das setAll in der Middleware hat das Token bereits erneuert; ignorieren.
          }
        },
      },
    },
  )
}
