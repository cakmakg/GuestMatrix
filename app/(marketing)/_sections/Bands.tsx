import type { ReactElement } from 'react'

import { ImageBand } from '../_components/ImageBand'

/**
 * Die Bildbänder zwischen den Abschnitten — die Atempausen der Vorlage.
 *
 * Sie erscheinen NUR, wenn es Bilder gibt. Heute gibt es keine, also rendert der Streifen `null`
 * und die Seite hat an dieser Stelle einfach nichts.
 *
 * Warum nicht einfach das Farbfeld zeigen, das `ImageBand` mitbringt: die Vorlage stellt hier
 * drei Bänder über die volle Breite. Bei 1240px Satzbreite und dem Verhältnis 16:6 sind das rund
 * 440 Pixel je Band — zusammen fast 1000 Pixel Scrollweg, auf denen nichts steht. Ein leeres
 * Farbfeld in dieser Größe liest sich nicht als Gestaltung, sondern als Bild, das nicht geladen
 * hat. Dieselbe Überlegung wie bei den Kundenstimmen: lieber ein Abschnitt weniger als eine
 * Hülle, die nach Baustelle aussieht.
 *
 * Der kleine quadratische Platzhalter im Schlussbanner bleibt dagegen sichtbar — der steht in
 * einer dunklen Karte und wirkt dort als Farbfläche gewollt.
 *
 * ── Bilder ergänzen ──────────────────────────────────────────────────────
 * `<Bands images={[{ src: '/…', alt: '…' }]} />` in `page.tsx`. Zwei Bilder ergeben das Paar
 * nebeneinander, eines das breite Einzelband. Zur Quelle gehört zweierlei: das Bild muss in die
 * `img-src`-Regel der CSP passen (next.config.ts), und die abgebildeten Gäste müssen der
 * Verwendung für WERBUNG zugestimmt haben — die Einwilligung im Gäste-Flow gilt der Kampagne,
 * nicht unserer Startseite.
 */
type BandImage = {
  src: string
  alt: string
}

type Props = {
  images?: readonly BandImage[]
  /** Folgt dem Grund des angrenzenden Abschnitts, damit keine Kante entsteht. */
  tone?: 'paper'
}

export function Bands({ images = [], tone }: Props): ReactElement | null {
  if (images.length === 0) return null

  return (
    <div className="gs-mkt-bandstrip" data-tone={tone}>
      <div className="gs-mkt-shell">
        <div className="gs-mkt-bands" data-columns={images.length > 1 ? '2' : undefined}>
          {images.map((image) => (
            <ImageBand key={image.src} src={image.src} alt={image.alt} ratio="wide" />
          ))}
        </div>
      </div>
    </div>
  )
}
