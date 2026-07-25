import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/types/database'

/**
 * BROWSER CLIENT
 *
 * Verwendung: Client-Komponenten (Dateien mit 'use client'-Direktive).
 * - Arbeitet mit dem Anon-Key → RLS-Richtlinien werden VOLLSTÄNDIG angewendet.
 * - Liest die Benutzersitzung automatisch aus localStorage/Cookie.
 * - createBrowserClient gibt einen Singleton zurück; bei jedem Aufruf wird keine neue Instanz erstellt.
 *
 * Beispiel:
 *   const supabase = createSupabaseBrowserClient()
 *   const { data } = await supabase.from('events').select('*')
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
