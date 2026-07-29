/**
 * Tarif-Registry — als Code gepflegt (analog zu lib/sectors).
 *
 * Preise/Abrechnung sind bewusst NICHT Teil dieser Schicht: hier stehen nur die
 * Tarife und ihre Kontingente. Die tatsächliche Bezahlung (Stripe) folgt in einem
 * eigenen Schnitt. Der Tarif eines Tenants steht in `tenants.plan` (Default 'free').
 *
 * Einen neuen Tarif hinzufügen: Wert in PLAN_TUPLE + Eintrag in PLANS ergänzen und
 * den CHECK-Wert der Migration erweitern.
 */

export const PLAN_TUPLE = ['free', 'pro'] as const

export type Plan = (typeof PLAN_TUPLE)[number]

export type PlanConfig = {
  label: string
  /** Maximale Anzahl aktiver (nicht archivierter) Kampagnen. */
  maxActiveEvents: number
  /** Maximale Anzahl abgeschlossener Uploads je Kampagne. */
  maxUploadsPerEvent: number
}

export const PLANS: Record<Plan, PlanConfig> = {
  free: { label: 'Free', maxActiveEvents: 1, maxUploadsPerEvent: 200 },
  pro: { label: 'Pro', maxActiveEvents: 20, maxUploadsPerEvent: 3000 },
}

export const DEFAULT_PLAN: Plan = 'free'

export function isPlan(value: string): value is Plan {
  return (PLAN_TUPLE as readonly string[]).includes(value)
}

export function getPlanConfig(plan: Plan): PlanConfig {
  return PLANS[plan]
}

/** Narrowing für DB-Strings: unbekannte/leere Werte fallen auf den Default-Tarif zurück. */
export function resolvePlan(value: string | null | undefined): Plan {
  return value && isPlan(value) ? value : DEFAULT_PLAN
}
