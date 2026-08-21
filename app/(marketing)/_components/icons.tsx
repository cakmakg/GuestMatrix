import type { ReactElement } from 'react'

import type { IconName } from '@/lib/marketing/icons'

/**
 * Die Strichzeichnungen der Marketing-Fläche.
 *
 * Getrennt von den Abschnitten, weil dasselbe Symbol an mehreren Stellen auftaucht (der Pfeil im
 * Hero und im Schlussbanner, die Kamera in Karte und Merkmalsleiste) — und weil eine Zeichnung
 * sonst als 15-zeiliger Block mitten im Fließtext eines Abschnitts steht.
 *
 * Die NAMEN stehen in `lib/marketing/icons.ts`, damit die Inhaltsschicht ein Symbol benennen kann,
 * ohne React zu importieren. `Record<IconName, …>` erzwingt hier die Vollständigkeit: ein neuer
 * Name drüben ohne Zeichnung hier bricht die Typprüfung.
 *
 * Keine Symbol-Bibliothek: die Vorlage bringt ihre eigenen, quadratisch endenden Striche mit, und
 * ein Paket dafür wäre eine Abhängigkeit für ein Dutzend Pfade. Strichstärke, Farbe und Füllung
 * setzt `.gs-mkt-icon` in app/globals.css.
 */
const ICON_PATHS: Record<IconName, ReactElement> = {
  album: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  camera: (
    <>
      <rect x="3" y="6" width="18" height="14" />
      <path d="M8 6l2-3h4l2 3" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  check: <path d="M5 12l5 5L20 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  heart: <path d="M12 21s-8-5-8-12a5 5 0 019-3 5 5 0 019 3c0 7-8 12-8 12z" />,
  hotel: (
    <>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M3 21h18" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
  message: <path d="M21 15a4 4 0 01-4 4H8l-5 4V6a4 4 0 014-4h10a4 4 0 014 4z" />,
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" />
      <path d="M10 19h4" />
      <path d="M9 6l2 2 4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  star: <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  trend: (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
  upload: <path d="M12 3v14M6 9l6-6 6 6M4 21h16" />,
  video: (
    <>
      <path d="M22 8l-6 4 6 4V8z" />
      <rect x="2" y="6" width="14" height="12" />
    </>
  ),
  window: (
    <>
      <rect x="3" y="4" width="18" height="16" />
      <path d="M3 9h18" />
    </>
  ),
}

type Props = {
  name: IconName
  size?: number
  /** Kräftigerer Strich für Symbole, die neben großer Schrift stehen (Buttons, Merkmalsleiste). */
  bold?: boolean
}

export function MktIcon({ name, size = 18, bold = false }: Props): ReactElement {
  return (
    <svg
      className="gs-mkt-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      data-weight={bold ? 'bold' : undefined}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}
