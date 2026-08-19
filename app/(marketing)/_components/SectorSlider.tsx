'use client'

import { useEffect, useState, type ReactElement, type ReactNode } from 'react'

/**
 * Der Wechsler im Hero: dieselbe Attrappe, drei Geschäftsarten.
 *
 * Die einzige Stelle der Startseite mit `"use client"` — und sie trägt nur den Zustand „welches
 * Bild ist vorn". Die Karten selbst kommen als `content` fertig vom Server herein; damit bleiben
 * ihr Markup und das QR-Muster (117 Rechtecke) aus dem Browser-Bündel.
 *
 * Alle Bilder stehen im HTML, sichtbar ist eines. Sie werden also mitgerendert und indexiert,
 * nicht nachgeladen — ein Wechsler, der Inhalte erst per Klick erzeugt, verbirgt sie vor jeder
 * Suchmaschine.
 */

const ROTATE_MS = 4500
/** Nach einem Klick bleibt das gewählte Bild stehen — lange genug, um es wirklich zu lesen. */
const RESUME_MS = 8000

export type SliderSlide = {
  key: string
  label: string
  content: ReactNode
}

export function SectorSlider({ slides }: { slides: readonly SliderSlide[] }): ReactElement | null {
  const [active, setActive] = useState(0)
  // 0 = läuft. Jeder Klick zählt hoch statt nur auf `true` zu setzen: sonst würde ein zweiter
  // Klick während der Pause die 8 Sekunden nicht neu starten, weil sich der Wert nicht ändert
  // und der Effekt nicht erneut liefe.
  const [pauseToken, setPauseToken] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = (): void => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // Wer Bewegung abbestellt hat, bekommt KEINEN selbstlaufenden Wechsler. Die Punkte bleiben,
  // das Bild wechselt dann nur auf Wunsch.
  useEffect(() => {
    if (reducedMotion || pauseToken > 0 || slides.length < 2) return
    const tick = setInterval(() => {
      setActive((index) => (index + 1) % slides.length)
    }, ROTATE_MS)
    return () => clearInterval(tick)
  }, [reducedMotion, pauseToken, slides.length])

  useEffect(() => {
    if (pauseToken === 0) return
    const resume = setTimeout(() => setPauseToken(0), RESUME_MS)
    return () => clearTimeout(resume)
  }, [pauseToken])

  if (slides.length === 0) return null

  function show(index: number): void {
    setActive(index)
    setPauseToken((token) => token + 1)
  }

  return (
    <>
      <div className="gs-mkt-slider">
        {slides.map((slide, index) => (
          <div
            key={slide.key}
            className="gs-mkt-slide"
            data-active={index === active}
            // Die verdeckten Bilder sollen nicht mitgelesen werden. Unbedenklich, weil in einer
            // Attrappe nichts fokussierbar ist.
            aria-hidden={index !== active}
          >
            {slide.content}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="gs-mkt-dots-wrap">
          <div className="gs-mkt-dots">
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className="gs-mkt-dot"
                data-active={index === active}
                aria-label={`Beispiel für ${slide.label} anzeigen`}
                aria-pressed={index === active}
                onClick={() => show(index)}
              />
            ))}
          </div>

          {/* Dieselbe Bedienung noch einmal als Wort — ein 14 Pixel großer Punkt sagt niemandem,
              wofür er steht, und ist auf dem Telefon kaum zu treffen. */}
          <div className="gs-mkt-dot-labels">
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className="gs-mkt-dot-label"
                data-active={index === active}
                onClick={() => show(index)}
              >
                {slide.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
