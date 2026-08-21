import type { ReactElement } from 'react'

/**
 * Ein Bildband — die ruhige Fläche zwischen zwei Abschnitten.
 *
 * In der Design-Vorlage steht an diesen Stellen ein `<image-slot>`: ein Bauteil des
 * Entwurfswerkzeugs, in das man ein Foto zieht. Im Produkt gibt es das nicht, und es gibt auch
 * noch keine Fotos — deshalb nimmt dieses Bauteil ein Bild ENTGEGEN und zeigt ohne eines ein
 * ruhiges Farbfeld.
 *
 * Ein Farbfeld statt eines gekauften Symbolfotos ist hier keine Verlegenheitslösung: fremde
 * Menschen als Deko auf einer Seite, deren ganzes Versprechen Einwilligung heißt, wären das
 * falsche erste Bild. Sobald echte Aufnahmen aus einer Kundenkampagne vorliegen (MIT
 * Einwilligung fürs Marketing — die Zustimmung des Gastes gilt der Kampagne, nicht unserer
 * Werbung), reicht ein `src`.
 *
 * `alt` ist Pflicht, sobald ein Bild gesetzt ist, und wird sonst nicht gebraucht: das leere
 * Band ist Dekoration und trägt `aria-hidden`.
 */
type Props = {
  /** Ohne Quelle rendert das Band sein Farbfeld. */
  src?: string
  alt?: string
  /** `wide` ist das flachere Format der gestapelten Bänder (16:6 statt 16:9). */
  ratio?: 'wide'
}

export function ImageBand({ src, alt, ratio }: Props): ReactElement {
  if (src === undefined) {
    return <div className="gs-mkt-band" data-ratio={ratio} aria-hidden="true" />
  }

  return (
    <div className="gs-mkt-band" data-ratio={ratio}>
      {/* Kein next/image: die Bänder sind rein dekorativ, und ihre Quelle ist bis heute nicht
          bekannt — weder Maße noch Host. Steht die Quelle fest, gehört sie hierher und in die
          `img-src`-Regel der CSP (next.config.ts). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt ?? ''} loading="lazy" decoding="async" />
    </div>
  )
}
