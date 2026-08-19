import Link from 'next/link'
import type { ReactElement } from 'react'

import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

import { MktIcon } from '../_components/icons'
import { SectorCard } from '../_components/SectorCard'
import { SectorSlider, type SliderSlide } from '../_components/SectorSlider'

/**
 * Erster Bildschirm: Versprechen, zwei Wege, ein Wechsler durch die Geschäftsarten.
 *
 * Die Bilder werden HIER auf dem Server gebaut und dem Wechsler fertig übergeben — er entscheidet
 * nur noch, welches vorn steht. Ihre Zahl und Reihenfolge stammen aus `MARKETING_SEGMENTS` und
 * damit aus derselben Registry, aus der auch die Registrierung ihre Auswahl nimmt.
 */
export function Hero(): ReactElement {
  const slides: SliderSlide[] = MARKETING_SEGMENTS.map((segment) => ({
    key: segment.option.value,
    label: segment.navLabel,
    content: <SectorCard content={segment.card} />,
  }))

  return (
    <div className="gs-mkt-shell">
      <section className="gs-mkt-hero">
        <div>
          <p className="gs-mkt-badge">▪ Jetzt in der Beta</p>

          <h1>
            Teile deine <span className="gs-mkt-em">Erfahrungen</span>. Ein QR-Code für alles.
          </h1>

          <p className="gs-mkt-hero-sub">
            Sammle Fotos, Videos und Feedback direkt von deinen Gästen — mit einem einzigen QR-Code.{' '}
            <strong>Ohne App. Ohne Anmeldung.</strong>
          </p>

          <div className="gs-mkt-hero-actions">
            <Link href="/signup" className="gs-mkt-btn" data-tone="green">
              Kostenlos starten
              <MktIcon name="arrow" size={18} bold />
            </Link>
            <Link href="/login" className="gs-mkt-btn" data-tone="ghost">
              Anmelden
            </Link>
          </div>

          {/* „In DE gehostet" stand hier in der Vorlage und ist bewusst NICHT übernommen: die
              Region der Supabase-Instanz ist nicht bestätigt. Eine Aussage über den
              Speicherort ist im Zweifel ein Rechtsversprechen, kein Werbetext. */}
          <p className="gs-mkt-trust">Keine Kreditkarte nötig · Ohne App · DSGVO-konform</p>
        </div>

        <div className="gs-mkt-hero-visual">
          <SectorSlider slides={slides} />
        </div>
      </section>
    </div>
  )
}
