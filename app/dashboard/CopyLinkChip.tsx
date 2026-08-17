'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Kopiert den Gästelink in die Zwischenablage — und sagt die Wahrheit, wenn das nicht geht.
 *
 * Zwei Wege, und die Grenze zwischen ihnen ist wichtiger als die Wege selbst:
 *
 *  1. `navigator.clipboard` — nur in einem SECURE CONTEXT vorhanden (https oder localhost). Wenn
 *     sie da ist und nicht wirft, IST der Link kopiert. Nur hier darf der Knopf „Kopiert" sagen.
 *  2. Sonst: der Link wird sichtbar und vorausgewählt eingeblendet, dazu ein „Öffnen".
 *
 * Dazwischen läuft still ein Versuch über `document.execCommand('copy')` — er hilft, wo er
 * funktioniert (Android Chrome über http), wird aber NICHT als Erfolg gemeldet. Grund ist ein
 * konkreter Fehlschlag am Gerät: iOS Safari liefert für `execCommand` ein `true` zurück, ohne
 * etwas in die Zwischenablage zu legen. Der Knopf sagte „Kopiert", die Zwischenablage war leer,
 * und der Betreiber stand mit einem Versprechen da, das niemand einlöst. Ein Knopf, der nicht
 * weiß, ob er gewirkt hat, darf keinen Erfolg behaupten.
 *
 * Die Auswahl im versteckten Feld folgt dem iOS-Rezept (contentEditable + Range +
 * `setSelectionRange`): `select()` allein ist dort an einem readonly-Feld wirkungslos.
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

/** iOS-taugliche Vollauswahl eines Textfelds. */
function selectAll(field: HTMLTextAreaElement): void {
  // readonly + `select()` ist auf iOS wirkungslos; contentEditable macht das Feld auswählbar,
  // ohne die Tastatur zu öffnen (das Feld liegt außerhalb des Sichtfelds).
  field.contentEditable = 'true'
  field.readOnly = false

  const range = document.createRange()
  range.selectNodeContents(field)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  field.setSelectionRange(0, field.value.length)
}

/** Stiller Versuch ohne sicheren Kontext. Sein Rückgabewert ist bewusst uninteressant. */
function tryLegacyCopy(url: string): void {
  try {
    const field = document.createElement('textarea')
    field.value = url
    field.style.position = 'fixed'
    field.style.top = '-1000px'
    document.body.appendChild(field)
    selectAll(field)
    document.execCommand('copy')
    document.body.removeChild(field)
  } catch {
    // Nichts zu retten — der sichtbare Link darunter ist der eigentliche Ausweg.
  }
}

export function CopyLinkChip({ url, label }: Props): React.ReactElement {
  const [state, setState] = useState<State>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async () => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url)
        setState('copied')
        if (resetTimer.current) clearTimeout(resetTimer.current)
        resetTimer.current = setTimeout(() => setState('idle'), 2000)
        return
      } catch {
        // Auch im sicheren Kontext kann die Berechtigung verweigert sein.
      }
    }

    tryLegacyCopy(url)
    setState('manual')
  }, [url])

  if (state === 'manual') {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span
          style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}
        >
          Ohne HTTPS sperrt der Browser die Zwischenablage — hier ist der Link:
        </span>
        <input
          className="input"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          autoFocus
        />
        {/* Auf dem Telefon der schnellste Weg zur Probe: der Betreiber sieht sofort, was der Gast
            sieht — ohne den Link irgendwo einfügen zu müssen. */}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 12,
            alignSelf: 'flex-start',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Öffnen
        </a>
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
