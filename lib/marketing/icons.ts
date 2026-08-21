/**
 * Die Namen der Strichzeichnungen auf der Marketing-Fläche — als reine Daten.
 *
 * Getrennt von den Zeichnungen selbst (`app/(marketing)/_components/icons.tsx`), damit die
 * Inhaltsschicht (`segments.ts`) ein Symbol benennen kann, ohne React zu importieren: `lib/`
 * bleibt so ohne JSX und ohne Abhängigkeit zur Oberfläche, und die Segment-Inhalte sind ohne
 * Renderer testbar.
 *
 * Der Zeichnungssatz drüben ist über `Record<IconName, ReactElement>` typisiert — ein neuer Name
 * hier ohne Zeichnung dort bricht die Typprüfung, nicht erst die Seite.
 */
export const ICON_NAMES = [
  'album',
  'arrow',
  'bolt',
  'camera',
  'check',
  'clock',
  'eye',
  'globe',
  'heart',
  'hotel',
  'lock',
  'message',
  'phone',
  'shield',
  'star',
  'trash',
  'trend',
  'upload',
  'video',
  'window',
] as const

export type IconName = (typeof ICON_NAMES)[number]
