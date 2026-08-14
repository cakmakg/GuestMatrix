'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { NavItem } from '@/lib/dashboard/nav'

import { NAV_ICONS } from './nav-icons'

/**
 * Die Schublade hinter dem Hamburger — nur auf Telefon/Tablet (`.gs-hamburger` ist ab 1024px
 * ausgeblendet, darüber steht die Seitenleiste).
 *
 * Sie ersetzt die frühere Seite `/dashboard/more`. Deren Problem war nicht das Aussehen, sondern
 * die Rechnung: ein eigener Bildschirm, der ausschließlich Links aufzählte, kostete einen
 * Fingertipp mehr als eine Schublade — und belegte dafür selbst einen der drei bis vier knappen
 * Plätze in der unteren Leiste.
 *
 * Was hier NICHT hineingehört: die täglichen Ziele. Die stehen unten, in Daumenreichweite. Die
 * Schublade ist für das, was man selten und dann bewusst aufsucht.
 */

type Props = {
  items: NavItem[]
  /** Tarifzeile am Fuß — dieselbe Information wie in der Seitenleiste. */
  planLabel: string
  planUsage: string
  planPercent: number
}

const ICON_MENU = (
  <svg viewBox="0 0 24 24">
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
)

const ICON_CLOSE = (
  <svg viewBox="0 0 24 24">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export function NavDrawer({ items, planLabel, planUsage, planPercent }: Props): React.ReactElement {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])

  // Nach einer Navigation schließen. Next wechselt die Seite clientseitig, ohne diese Komponente
  // auszuhängen — ohne die Zeile bliebe die Schublade über dem neuen Bildschirm stehen.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      if (event.key !== 'Tab') return

      // Fokusfalle — wie im Vollbild der Galerie: ein offener Dialog, aus dem Tab hinausführt,
      // blättert unsichtbar durch die Seite dahinter.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="gs-hamburger"
        onClick={() => setOpen(true)}
        aria-label="Menü öffnen"
        aria-expanded={open}
      >
        <span className="gs-icn" aria-hidden="true">
          {ICON_MENU}
        </span>
      </button>

      {open && (
        <div className="gs-drawer">
          {/* Der Grund schließt beim Antippen. Als <button> und nicht als <div onClick>, damit
              er per Tastatur erreichbar bleibt und Screenreader ihn als Bedienelement melden. */}
          <button
            type="button"
            className="gs-drawer-backdrop"
            onClick={close}
            aria-label="Menü schließen"
            tabIndex={-1}
          />

          <div
            className="gs-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            ref={panelRef}
          >
            <div className="gs-drawer-head">
              <span className="gs-drawer-title">Menü</span>
              <button type="button" onClick={close} aria-label="Menü schließen">
                <span className="gs-icn" aria-hidden="true">
                  {ICON_CLOSE}
                </span>
              </button>
            </div>

            <nav className="gs-drawer-nav">
              {items.map((item) => {
                const isCurrent =
                  item.href === '/dashboard'
                    ? pathname === item.href
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    <span className="gs-icn" aria-hidden="true">
                      {NAV_ICONS[item.id]}
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="gs-drawer-foot">
              <div className="gs-drawer-plan">{planLabel}</div>
              <div className="gs-drawer-usage">{planUsage}</div>
              <div className="gs-bar" style={{ marginTop: 8 }}>
                <i style={{ width: `${planPercent}%` }} />
              </div>

              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="btn btn-secondary" style={{ marginTop: 14 }}>
                  Abmelden
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
