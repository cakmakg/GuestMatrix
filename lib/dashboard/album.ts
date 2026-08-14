/**
 * Album-Ansicht der beitragszentrierten Galerie (Gästebuch) — reine Funktionen.
 *
 * Wie die Medien-Filter: keine DB, kein Storage. Die Seite lädt die Zeilen und signiert die
 * URLs, diese Funktionen benennen und zählen sie.
 *
 * Die Datumsformate sind bewusst von Hand gebaut statt über `Intl`/`toLocaleDateString`: die
 * übrigen Dashboard-Formate in `metrics.ts` sind es auch, und ein hart geschriebener Monatsname
 * liefert in jedem Node-Build (auch ohne volle ICU-Daten) dasselbe Ergebnis — was diese
 * Funktionen ohne Zeitzonen-Vorbehalt testbar macht.
 */

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const

/** `null`, wenn kein oder ein unlesbares Datum vorliegt (defensiv gegen krumme DB-Werte). */
function parseDate(iso: string | null): Date | null {
  if (iso === null) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** „14. Juni 2026" — Datumszeile im Albumkopf. */
export function formatAlbumDate(iso: string | null): string {
  const date = parseDate(iso)
  if (date === null) return ''
  return `${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * „21:47" — Uhrzeit eines einzelnen Beitrags im Vollbild.
 *
 * Im Strom steht die RELATIVE Zeit („vor 1 Std.", `formatRelative`): beim Durchsehen zählt, wie
 * frisch ein Beitrag ist. Hat man einen einzelnen geöffnet, zählt der Moment des Abends — und
 * dafür sagt „23:41" mehr als „vor 3 Std.".
 */
export function formatTimeOfDay(iso: string | null): string {
  const date = parseDate(iso)
  if (date === null) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Wie viele verschiedene Gäste etwas hinterlassen haben — für „von 34 Gästen" im Albumkopf.
 *
 * Gezählt werden getrimmte, nicht-leere Namen ohne Rücksicht auf Groß-/Kleinschreibung („Oma
 * Erna" und „oma erna" sind eine Person). Namenlose Beiträge zählen NICHT mit: im Gästebuch ist
 * der Name Pflicht, ein fehlender Wert ist also ein Altbestand oder ein Datenfehler — und eine
 * Zahl, die im Zweifel zu niedrig liegt, ist im Albumkopf besser als eine erfundene.
 */
export function countContributors(items: readonly { guestName?: string | null }[]): number {
  const names = new Set<string>()
  for (const item of items) {
    const name = item.guestName?.trim().toLowerCase()
    if (name) names.add(name)
  }
  return names.size
}
