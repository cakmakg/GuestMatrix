/**
 * Neutraler Plattform-Default-Markenname (KEIN Sektorname).
 *
 * Die gästeseitige Marke kommt IMMER aus `tenants.brand_name` (bei der Registrierung
 * erfasst, via `raw_user_meta_data` in den handle_new_user-Trigger getragen). `BRAND` ist
 * nur der generische Fallback für Betreiber-/Auth-Seiten, wenn (noch) keine Tenant-Marke
 * vorliegt. Momento bleibt als dormantes Event/Hochzeit-Modul erhalten, ist aber nicht mehr
 * die Plattform-Default-Marke. Slogan lokalisierbar.
 */
export const BRAND = {
  name: 'GuestMatrix',
  slogan: 'Jeder Gast, jeder Moment.',
} as const
