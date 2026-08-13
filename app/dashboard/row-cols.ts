import type { CSSProperties } from 'react'

/**
 * Spaltenbreiten einer `.gs-row` als CSS-Custom-Property statt als direkte Deklaration.
 *
 * Der Unterschied ist der Grund, warum es diese Funktion gibt: `style={{ gridTemplateColumns }}`
 * landet als Inline-Deklaration im Element und schlägt damit JEDE Regel aus globals.css — auch
 * die Media Query, die die Spalten auf dem Telefon stapeln soll. Eine Custom Property setzt
 * dagegen nur den Wert, den die Basisregel per `var()` liest; die Telefonregel überschreibt
 * anschließend `grid-template-columns` selbst und gewinnt.
 *
 * Die Typzusicherung ist unvermeidbar: Reacts `CSSProperties` kennt keine Custom Properties.
 * Sie steht bewusst nur an dieser einen Stelle, statt an jedem Aufrufort wiederholt zu werden.
 */
export function rowCols(columns: string): CSSProperties {
  return { '--gs-row-cols': columns } as CSSProperties
}
