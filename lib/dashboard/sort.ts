/**
 * Sortierrichtung und der Zustand einer klickbaren Spaltenüberschrift.
 *
 * Rein (kein React, keine DB): die Seiten bauen daraus Adressen, `tests/dashboard-sort.test.ts`
 * prüft die Regeln ohne Rendering — dasselbe Muster wie bei den Filtern.
 *
 * Warum die Richtung überhaupt in die Adresse gehört: bis hierhin war jede Sortierung an eine
 * feste Richtung geknüpft (Datum immer neueste zuerst, Name immer A–Z, Antworten immer meiste
 * zuerst). Die ÄLTESTE Feier oder Z–A war damit nicht erreichbar, und die Tabelle zeigte nicht
 * einmal an, wonach sie gerade sortiert ist — das stand nur im Auswahlfeld der Filterleiste.
 */

export const SORT_DIR_TUPLE = ['asc', 'desc'] as const

export type SortDir = (typeof SORT_DIR_TUPLE)[number]

export function flipDir(dir: SortDir): SortDir {
  return dir === 'asc' ? 'desc' : 'asc'
}

export type SortHeaderState = {
  /** Wird nach DIESER Spalte sortiert? */
  active: boolean
  /** Was ein Klick auf diese Überschrift setzt. */
  next: { sort: string; dir: SortDir }
}

/**
 * `firstDir` ist die Richtung beim ERSTEN Klick auf eine Spalte, nach der noch nicht sortiert wird.
 * Sie ist eine Aussage über die SPALTE, nicht über den Zustand: bei Namen erwartet man A–Z, bei
 * Daten und Zahlen das Neueste/Größte zuerst. Ein weiterer Klick auf dieselbe Spalte dreht.
 *
 * Bewusst KEINE dritte Stufe („unsortiert"): eine Liste ohne Ordnung gibt es nicht — sie hätte
 * dann die Reihenfolge der Datenbank, und die ist keine Aussage.
 */
export function sortHeaderState(
  column: string,
  firstDir: SortDir,
  activeSort: string,
  activeDir: SortDir,
): SortHeaderState {
  if (column !== activeSort) {
    return { active: false, next: { sort: column, dir: firstDir } }
  }

  return { active: true, next: { sort: column, dir: flipDir(activeDir) } }
}

/**
 * Vergleicht zwei Werte AUFSTEIGEND; die Richtung dreht der Aufrufer, indem er das Ergebnis
 * negiert. Ein Komparator je Schlüssel statt zwei — sonst driften auf- und absteigend
 * auseinander (etwa bei der Umlautbehandlung).
 */
export function withDir(comparison: number, dir: SortDir): number {
  return dir === 'asc' ? comparison : -comparison
}
