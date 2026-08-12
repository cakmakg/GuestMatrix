'use client'

import type { CSSProperties, ReactNode } from 'react'

/**
 * Submit-Button mit Rückfrage vor dem Absenden.
 *
 * Die Löschung eines Gästebeitrags ist endgültig: Storage-Hard-Delete plus Soft-Delete
 * (lib/submissions/delete-submission.ts) — kein Papierkorb, keine Wiederherstellung. In den
 * Listen stehen die Zeilen dicht beieinander, ein Fehlklick entfernt fremde Gästemedien
 * unwiederbringlich. Deshalb steht zwischen Klick und Server Action eine Bestätigung.
 *
 * Bewusst ist NUR der Button Client-Code: Formular und Action bleiben serverseitig. Ohne
 * JavaScript entfällt die Rückfrage und das Formular sendet regulär ab — die eigentliche
 * Berechtigungsprüfung liegt ohnehin in der Action und in der RLS, nicht in diesem Dialog.
 */

type Props = {
  confirmMessage: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}

export function ConfirmSubmit({
  confirmMessage,
  children,
  className,
  style,
  ariaLabel,
}: Props): React.ReactElement {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
