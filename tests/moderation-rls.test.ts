import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

// Sicherheits-Guard: Die Moderation (Flag/Unflag) läuft über den RLS-aktiven Server-Client.
// tenant_update_submissions (RLS) autorisiert das Flag-Update, tenant_select_submissions liest
// ownership-scoped — nur der Tenant der Einreichung kann flaggen. Der service_role-Admin-Client
// (umgeht ALLE RLS-Policies) darf in diesen Mutations-Pfaden NICHT importiert werden; diese
// Prüfung verhindert eine stille Rückkehr zum Admin-Client.

const ROOT = process.cwd()

// `moderateAction` liegt seit der Medien-Bibliothek in den gemeinsamen Dashboard-Aktionen
// (mehrere Seiten lösen sie aus), nicht mehr im Kampagnen-Routenordner.
const MODERATION_MUTATION_PATHS = [
  'app/dashboard/actions.ts',
  'app/api/submissions/[submissionId]/moderate/route.ts',
] as const

function readSource(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

describe('moderation flag mutation is RLS-active (no service_role)', () => {
  it.each(MODERATION_MUTATION_PATHS)(
    '%s does not import the admin (service_role) client',
    (relPath) => {
      expect(readSource(relPath)).not.toContain('@/lib/supabase/admin')
    },
  )

  it.each(MODERATION_MUTATION_PATHS)('%s uses the RLS-active server client', (relPath) => {
    expect(readSource(relPath)).toContain('@/lib/supabase/server')
  })
})
