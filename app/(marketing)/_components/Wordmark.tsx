import type { ReactElement } from 'react'

import { BRAND } from '@/lib/brand'

/**
 * Die Wortmarke: Zeichen plus Name.
 *
 * Ein eigenes Bauteil, weil sie an drei Stellen steht (Kopfleiste, Fuß, 404-Seite) und weil das
 * Zeichen aus mehreren Ebenen besteht — dreimal derselbe Block wäre dreimal dieselbe Gelegenheit,
 * beim nächsten Feinschliff auseinanderzulaufen.
 *
 * Der Name kommt aus `BRAND` und steht nicht als Literal im Markup: die Plattform ist 2026 schon
 * einmal umbenannt worden, und die Stellen, die den Namen hart eingetragen hatten, waren genau
 * die, die man dabei übersieht.
 *
 * Das Zeichen selbst trägt kein `alt` und keine Rolle: der Name steht direkt daneben als Text,
 * ein zweites Mal wäre im Screenreader Doppelung. Die Beschriftung des LINKS setzt der Aufrufer.
 */
export function Wordmark(): ReactElement {
  return (
    <>
      <span className="gs-mkt-logo-mark" aria-hidden="true">
        <span>{BRAND.name.charAt(0)}</span>
      </span>
      <span className="gs-mkt-logo-word">{BRAND.name}</span>
    </>
  )
}
