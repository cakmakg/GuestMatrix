import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

// Sicherheits-Guard: Das Tenant-Dashboard liest Daten ausschließlich über den RLS-aktiven
// Server-Client. Der service_role-Admin-Client (umgeht ALLE RLS-Policies) darf in diesen
// Seiten NICHT importiert werden — Tenant-Isolierung ist DB-durchgesetzt (Spec C-3). Signierte
// Storage-URLs bleiben eine bewusst gekapselte Ausnahme in lib/storage/signed-url.ts und tauchen
// hier nicht als Admin-Import auf. Diese Prüfung verhindert eine stille Rückkehr zum Admin-Client.

const ROOT = process.cwd()

const DASHBOARD_READ_PAGES = [
  'app/dashboard/page.tsx',
  'app/dashboard/events/[eventId]/page.tsx',
] as const

function readSource(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

describe('dashboard reads are RLS-active (no service_role in frontend reads)', () => {
  it.each(DASHBOARD_READ_PAGES)('%s does not import the admin (service_role) client', (relPath) => {
    expect(readSource(relPath)).not.toContain('@/lib/supabase/admin')
  })

  it.each(DASHBOARD_READ_PAGES)('%s uses the RLS-active server client', (relPath) => {
    expect(readSource(relPath)).toContain('@/lib/supabase/server')
  })
})
