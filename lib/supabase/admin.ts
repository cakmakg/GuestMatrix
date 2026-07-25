import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * ADMIN CLIENT  ⚠️  NUR SERVER-SEITIG
 *
 * Verwendung: Ausschließlich für privilegierte serverseitige Operationen.
 *   - Phase-0-Beispiel: Ersten Tenant-Eintrag anlegen (Seed-Skript).
 *   - Phase-2-Beispiel: Moderationsjob, Massen-Datenlöschung, Webhook-Handler.
 *
 * KRITISCHE REGELN:
 *   ❌ Niemals in eine Datei mit 'use client' importieren.
 *   ❌ Keine NEXT_PUBLIC_-Umgebungsvariable verwenden — service_role-Key darf nicht zum Client gelangen.
 *   ❌ Nicht auf RLS verlassen — dieser Client umgeht ALLE RLS-Richtlinien.
 *   ✅ Nur für zwingend notwendige privilegierte Operationen verwenden; danach zum normalen Client zurückwechseln.
 *
 * Variablen ohne NEXT_PUBLIC_-Präfix werden von Next.js nicht in das Client-Bundle aufgenommen.
 */
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

export { supabaseAdmin }
