import { ImageResponse } from 'next/og'

import { BRAND } from '@/lib/brand'

/**
 * Das Zeichen im Browser-Tab — erzeugt, nicht als Datei abgelegt.
 *
 * Dieselbe Begründung wie beim Vorschaubild (`app/(marketing)/opengraph-image.tsx`): Marke und
 * Farben stehen im Code, also entsteht das Zeichen daraus. Eine .ico-Datei im Repository wäre die
 * eine Stelle, die eine Umbenennung NICHT mitbekommt — und genau das ist 2026 einmal passiert.
 *
 * Die Datei liegt im Wurzel-Ordner und gilt damit für ALLE Flächen: Landing, Dashboard und den
 * Gäste-Flow. Das ist beabsichtigt — der Tab gehört der Plattform, nicht der Kampagne.
 *
 * Bei 32 Pixeln bleibt vom Schriftzug „Momento" nur der Anfangsbuchstabe lesbar. Das Zeichen
 * trägt deshalb NUR das M — in derselben Form wie die Wortmarke auf der Seite
 * (`app/(marketing)/_components/Wordmark.tsx`): dunkle Scheibe, heller Buchstabe.
 *
 * Der gestrichelte Innenring der großen Marke fehlt hier bewusst: bei 32 Pixeln würde er zu
 * einem grauen Schleier verlaufen und den Buchstaben nur schlechter lesbar machen.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const PAPER = '#efeadd'
const INK = '#1a1a1a'

export default function Icon(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: INK,
        color: PAPER,
        fontSize: 20,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {BRAND.name.charAt(0)}
    </div>,
    size,
  )
}
