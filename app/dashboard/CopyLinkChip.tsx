'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Kopiert den Gästelink in die Zwischenablage.
 *
 * Drei Wege, absteigend nach Zuverlässigkeit — und der dritte ist keine Zierde:
 *
 *  1. `navigator.clipboard` — nur in einem SECURE CONTEXT vorhanden (https oder localhost).
 *     Genau daran scheitert es im Alltag dieses Projekts: das Dashboard wird zum Testen über
 *     `http://192.168.x.x:3000` vom Telefon aufgerufen, und dort ist die API schlicht `undefined`.
 *  2. `document.execCommand('copy')` über ein kurzlebiges Textfeld — veraltet, funktioniert aber
 *     auch ohne sicheren Kontext.
 *  3. Klappt beides nicht, wird der Link sichtbar und vorausgewählt eingeblendet. Manuell
 *     kopieren ist unbequem, ein Knopf ohne Wirkung wäre schlimmer.
 */

type Props = {
  url: string
  label: string
}

type State = 'idle' | 'copied' | 'manual'

const ICON_LINK = (
  <svg viewBox="0 0 24 24">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
)

const ICON_CHECK = (
  <svg viewBox="0 0 24 24">
    <path d="M4 12.5l5.5 5.5L20 7" />
  </svg>
)

async function writeToClipboard(url: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
    // Auch im sicheren Kontext kann der Nutzer die Berechtigung verweigert haben.
  }

  try {
    const field = document.createElement('textarea')
    field.value = url
    // Außerhalb des Sichtfelds, aber fokussierbar — `display:none` wäre nicht auswählbar.
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.top = '-1000px'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}

export function CopyLinkChip({ url, label }: Props): React.ReactElement {
  const [state, setState] = useState<State>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async () => {
    const ok = await writeToClipboard(url)
    setState(ok ? 'copied' : 'manual')

    if (ok) {
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setState('idle'), 2000)
    }
  }, [url])

  if (state === 'manual') {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span
          style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}
        >
          Kopieren hat der Browser abgelehnt — hier ist der Link:
        </span>
        <input
          className="input"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          autoFocus
        />
      </span>
    )
  }

  return (
    <button type="button" className="gs-chip" onClick={copy}>
      <span className="gs-icn" aria-hidden="true">
        {state === 'copied' ? ICON_CHECK : ICON_LINK}
      </span>
      {state === 'copied' ? 'Kopiert' : label}
    </button>
  )
}
