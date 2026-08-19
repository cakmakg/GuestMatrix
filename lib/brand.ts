/**
 * Plattform-Markenname.
 *
 * Die gästeseitige Marke kommt IMMER aus `tenants.brand_name` (bei der Registrierung erfasst,
 * via `raw_user_meta_data` in den handle_new_user-Trigger getragen). `BRAND` ist der Rückfall
 * für Betreiber-, Auth- und Marketing-Seiten, wenn (noch) keine Tenant-Marke vorliegt.
 *
 * Namenshinweis: „Momento" ist seit der Landing-Page wieder die PLATTFORM-Marke. In älteren
 * Kommentaren (z. B. `lib/sectors/event/`) steht derselbe Name als Spitzname des
 * Event/Hochzeit-Moduls — gemeint ist dort der Kampagnentyp `wedding`, nicht die Plattform.
 *
 * Einziger Ableitungspunkt: wer den Namen anzeigt, liest ihn hier — nicht als Literal in der
 * Seite. Slogan lokalisierbar.
 */
export const BRAND = {
  name: 'Momento',
  slogan: 'Teile deine Erfahrungen.',
} as const
