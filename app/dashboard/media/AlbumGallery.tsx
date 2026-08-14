'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { formatTimeOfDay } from '@/lib/dashboard/album'
import { formatRelative } from '@/lib/dashboard/metrics'
import type { MediaKind } from '@/lib/dashboard/media-filters'

import { deleteFromDashboardAction, moderateAction } from '../actions'
import { ConfirmSubmit } from '../ConfirmSubmit'

/**
 * Die beitragszentrierte Galerie als Beitragsstrom.
 *
 * Ein Raster zeigt Dateien, dieser Strom zeigt Beiträge: erst wer etwas hinterlassen hat und
 * wann, dann seine Worte, dann sein Foto. Im Gästebuch ist der Name die halbe Botschaft — und
 * ein Gruß ohne Foto war im Raster nur ein Loch, das man mit einer Ersatzkachel füllen musste.
 *
 * Warum Client-Code: das Vollbild braucht Auswahlzustand. Die Mutationen bleiben Server Actions
 * in `../actions` (RLS-geprüft, mit revalidatePath); dieses Modul hält nur den offenen Index.
 */

export type AlbumItem = {
  id: string
  /** Signierte Storage-URL; `null`, wenn das Signieren fehlschlug oder kein Medium existiert. */
  url: string | null
  kind: MediaKind
  hasMedia: boolean
  guestName: string | null
  comment: string | null
  blocked: boolean
  uploadedAt: string | null
  /** Nur gesetzt, wenn der Tenant mehrere Feiern hat — sonst wäre die Zeile überall gleich. */
  eventName: string | null
}

type Props = {
  items: AlbumItem[]
  emptyText: string
}

const SWIPE_THRESHOLD_PX = 48

const ICON_EYE = (
  <svg viewBox="0 0 24 24">
    <path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
)

const ICON_EYE_OFF = (
  <svg viewBox="0 0 24 24">
    <path d="M9.9 5.8A8.9 8.9 0 0 1 12 5.5c6.5 0 10.2 6.5 10.2 6.5a17 17 0 0 1-3.4 4.2M6.2 7.8A17 17 0 0 0 1.8 12S5.5 18.5 12 18.5c1.5 0 2.8-.3 4-.8" />
    <path d="M10 10a3.2 3.2 0 0 0 4.3 4.3" />
    <path d="M3 3l18 18" />
  </svg>
)

function displayName(item: AlbumItem): string {
  return item.guestName?.trim() || 'Ohne Namen'
}

function altTextFor(item: AlbumItem): string {
  const caption = item.comment?.trim()
  if (caption) return caption
  const name = item.guestName?.trim()
  return name ? `Beitrag von ${name}` : 'Gästebeitrag'
}

export function AlbumGallery({ items, emptyText }: Props): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const touchStartX = useRef<number | null>(null)

  // Einmal beim Rendern festgehalten: `formatRelative` gegen `Date.now()` bei jedem Aufruf
  // ergäbe für zwei Karten desselben Durchlaufs unterschiedliche Bezugspunkte.
  const [now] = useState(() => Date.now())

  const isOpen = openIndex !== null
  const current = openIndex === null ? null : (items[openIndex] ?? null)

  const close = useCallback(() => {
    setOpenIndex(null)
    triggerRef.current?.focus()
  }, [])

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((index) => {
        if (index === null) return null
        return Math.min(items.length - 1, Math.max(0, index + delta))
      })
    },
    [items.length],
  )

  // Tastatur + Rollsperre. Das Vollbild liegt über der Seite; ohne die Sperre scrollt darunter
  // der Strom weiter, und beim Schließen steht man an einer anderen Stelle als vorher.
  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(-1)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        step(1)
        return
      }
      if (event.key !== 'Tab') return

      // Fokusfalle: ein Dialog, aus dem Tab hinausführt, blättert unsichtbar durch die Seite
      // dahinter. Die Liste wird bei jedem Tab neu erhoben, weil sich der Inhalt des Dialogs
      // je nach Beitrag unterscheidet (Video ohne Download, Gruß ohne Bild).
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
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
  }, [isOpen, close, step])

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus()
  }, [isOpen])

  // Nach einer Löschung kommt die Liste kürzer zurück (revalidatePath). Zeigt der offene Index
  // ins Leere, wird geschlossen statt kommentarlos ein fremder Beitrag gezeigt.
  useEffect(() => {
    if (openIndex !== null && openIndex >= items.length) setOpenIndex(null)
  }, [items.length, openIndex])

  const openAt = useCallback((index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = event.currentTarget
    setOpenIndex(index)
  }, [])

  if (items.length === 0) {
    return <p className="gs-album-empty">{emptyText}</p>
  }

  return (
    <>
      <div className="gs-feed gs-rise" data-i="2">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="gs-feed-card"
            data-kind={item.hasMedia ? 'media' : 'note'}
            data-blocked={item.blocked ? 'true' : 'false'}
          >
            <div className="gs-feed-head">
              <div className="gs-feed-who">
                <div className="gs-feed-name">{displayName(item)}</div>
                <div className="gs-feed-when">
                  {formatRelative(item.uploadedAt, now)}
                  {item.eventName && ` · ${item.eventName}`}
                </div>
              </div>

              {/* Ausblenden ist die einzige Entscheidung, die man im Vorbeiscrollen trifft —
                  deshalb steht sie hier und nicht erst im Vollbild. */}
              <form action={moderateAction.bind(null, item.id, !item.blocked)}>
                <button
                  type="submit"
                  className="gs-feed-toggle"
                  title={item.blocked ? 'Wieder zeigen' : 'Ausblenden'}
                  aria-label={
                    item.blocked
                      ? `Beitrag von ${displayName(item)} wieder zeigen`
                      : `Beitrag von ${displayName(item)} ausblenden`
                  }
                >
                  <span className="gs-icn" aria-hidden="true">
                    {item.blocked ? ICON_EYE_OFF : ICON_EYE}
                  </span>
                </button>
              </form>
            </div>

            {item.comment?.trim() && (
              <p className="gs-feed-text">
                {item.hasMedia ? `„${item.comment.trim()}“` : item.comment.trim()}
              </p>
            )}

            {item.hasMedia && item.url !== null && (
              <button
                type="button"
                className="gs-feed-media"
                onClick={(event) => openAt(index, event)}
                aria-label={`${altTextFor(item)} — in voller Größe öffnen`}
              >
                {item.kind === 'video' ? (
                  <video src={item.url} preload="metadata" muted playsInline />
                ) : (
                  /* Bewusst <img>: die Quelle ist eine signierte Storage-URL, die abläuft.
                     next/image würde sie über den Optimizer spiegeln und damit über ihre
                     Gültigkeit hinaus cachen. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={altTextFor(item)} loading="lazy" />
                )}
                {item.kind === 'video' && (
                  <span className="gs-album-play" aria-hidden="true">
                    ▶
                  </span>
                )}
                {item.blocked && <span className="gs-album-flag">Ausgeblendet</span>}
              </button>
            )}
          </article>
        ))}
      </div>

      {current && openIndex !== null && (
        <div
          className="gs-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={altTextFor(current)}
          tabIndex={-1}
          ref={dialogRef}
        >
          <div className="gs-lightbox-bar">
            <span>
              {openIndex + 1} von {items.length}
            </span>
            <button type="button" onClick={close} aria-label="Schließen">
              ×
            </button>
          </div>

          <div
            className="gs-lightbox-stage"
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(event) => {
              const start = touchStartX.current
              const end = event.changedTouches[0]?.clientX
              touchStartX.current = null
              if (start === null || end === undefined) return
              const distance = end - start
              if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return
              step(distance < 0 ? 1 : -1)
            }}
          >
            {!current.hasMedia ? (
              <div className="gs-lightbox-paper">{current.comment?.trim() || 'Ohne Text'}</div>
            ) : current.url === null ? (
              <p style={{ color: 'var(--lightbox-fg)', fontSize: 13 }}>Vorschau nicht verfügbar.</p>
            ) : current.kind === 'video' ? (
              <video src={current.url} controls playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={altTextFor(current)} />
            )}

            {openIndex > 0 && (
              <button
                type="button"
                className="gs-lightbox-nav"
                data-dir="prev"
                onClick={() => step(-1)}
                aria-label="Vorheriger Beitrag"
              >
                ‹
              </button>
            )}
            {openIndex < items.length - 1 && (
              <button
                type="button"
                className="gs-lightbox-nav"
                data-dir="next"
                onClick={() => step(1)}
                aria-label="Nächster Beitrag"
              >
                ›
              </button>
            )}
          </div>

          <div className="gs-lightbox-sheet">
            {/* Bei einem reinen Gruß steht der Text bereits groß auf der Karte — hier stünde er
                ein zweites Mal. */}
            {current.hasMedia && current.comment?.trim() && (
              <p className="gs-lightbox-msg">{current.comment.trim()}</p>
            )}

            <span className="gs-lightbox-who">
              {displayName(current)}
              {current.uploadedAt && ` · ${formatTimeOfDay(current.uploadedAt)}`}
              {current.eventName && ` · ${current.eventName}`}
            </span>

            <div className="gs-lightbox-actions">
              <form action={moderateAction.bind(null, current.id, !current.blocked)}>
                <button type="submit" className="quiet">
                  {current.blocked ? 'Wieder zeigen' : 'Ausblenden'}
                </button>
              </form>

              {current.url !== null && (
                <a href={current.url} download>
                  Herunterladen
                </a>
              )}

              {/* Schließt VOR der Löschung: danach ist der Beitrag fort, und ein Vollbild, das
                  auf den nachrückenden Nachbarn springt, sieht aus wie ein Fehlgriff. Bricht die
                  Rückfrage ab, verhindert ConfirmSubmit das Absenden — dann feuert auch dieses
                  onSubmit nicht. */}
              <form
                action={deleteFromDashboardAction.bind(null, current.id)}
                onSubmit={() => setOpenIndex(null)}
              >
                <ConfirmSubmit confirmMessage="Diesen Beitrag endgültig löschen? Foto, Video und Text werden unwiderruflich entfernt.">
                  Löschen
                </ConfirmSubmit>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
