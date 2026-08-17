import Link from 'next/link'

import { hrefWith } from '@/lib/dashboard/filter-chips'
import { sortHeaderState, type SortDir } from '@/lib/dashboard/sort'

const CARET = (
  <svg viewBox="0 0 24 24">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

type Props = {
  label: string
  /** Sortierschlüssel dieser Spalte (`sort`-Wert in der Adresse). */
  column: string
  /** Richtung beim ersten Klick — kommt aus der Filter-Schicht der Liste. */
  firstDir: SortDir
  activeSort: string
  activeDir: SortDir
  basePath: string
  /**
   * Der übrige Zustand der Adresse (Filter, Zeitraum). Sortieren darf keinen Filter abwerfen —
   * deshalb wird der Link daraus gebaut und nicht aus `?sort=` allein.
   */
  query: Readonly<Record<string, string | undefined>>
  /** Rechts ausgerichtete Zahlenspalten (z. B. „Ø"). */
  align?: 'end'
}

/**
 * Eine klickbare Spaltenüberschrift — dieselbe für jede Liste des Dashboards.
 *
 * Kein Client-Component: die Sortierung steht in der Adresse, ein Klick ist eine Navigation. Damit
 * funktioniert sie ohne JavaScript, ist teilbar und der Zurück-Knopf führt zur vorigen Ordnung.
 *
 * Bewusst OHNE `aria-sort`: das Attribut ist nur an einer Zelle mit `columnheader`-Rolle gültig,
 * und diese Listen sind keine Tabellen, sondern ein Raster aus `.gs-row`-Zeilen — auf dem Telefon
 * stapeln die Zellen sogar. Eine Tabellenrolle zu behaupten, die das Layout nicht einlöst, hilft
 * niemandem. Stattdessen sagt der zugängliche Name, was der Klick TUT („Nach Name sortieren,
 * A–Z"), und `aria-current` markiert die Spalte, nach der gerade sortiert wird.
 */
export function SortHeader({
  label,
  column,
  firstDir,
  activeSort,
  activeDir,
  basePath,
  query,
  align,
}: Props): React.ReactElement {
  const state = sortHeaderState(column, firstDir, activeSort, activeDir)
  const direction = state.next.dir === 'asc' ? 'aufsteigend' : 'absteigend'

  return (
    <Link
      className="gs-sort"
      href={hrefWith(basePath, query, state.next)}
      data-active={state.active ? 'true' : undefined}
      // Die Pfeilrichtung zeigt die AKTUELLE Ordnung, nicht die des nächsten Klicks: sie ist eine
      // Anzeige, keine Ankündigung.
      data-dir={state.active ? activeDir : undefined}
      data-align={align}
      aria-current={state.active ? 'true' : undefined}
      aria-label={`${label} — nach dieser Spalte ${direction} sortieren`}
    >
      {label}
      <span className="gs-sort-caret" aria-hidden="true">
        {CARET}
      </span>
    </Link>
  )
}
