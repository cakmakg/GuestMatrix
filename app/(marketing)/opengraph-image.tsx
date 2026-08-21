import { ImageResponse } from 'next/og'

import { BRAND } from '@/lib/brand'

/**
 * Das Vorschaubild, das ein Messenger oder ein soziales Netz zeigt, wenn jemand die Adresse teilt.
 *
 * Erzeugt statt gemalt: die Grafik hängt an `BRAND` und an den Farben der Fläche. Wird die Marke
 * umbenannt (das ist erst 2026 passiert), stimmt das Bild mit, statt als PNG im Repository zu
 * veralten — genau dieser Fall ist bei Logos die Regel, nicht die Ausnahme.
 *
 * Die Datei liegt in der Marketing-Gruppe und gilt damit für deren Seiten (Startseite, Impressum,
 * Datenschutzerklärung). Das Dashboard und der Gäste-Flow bekommen bewusst KEIN Vorschaubild:
 * dort ist jede geteilte Adresse ein Versehen, und ein hübsches Kärtchen dazu lädt zum
 * Weiterleiten ein.
 *
 * Zur Schrift: hier steht die Standardschrift der Bilderzeugung, nicht DM Serif Display. Die
 * Schriften der Seite kommen über `next/font` und liegen nach dem Build als Dateien mit
 * Prüfsummen-Namen — es gibt keinen stabilen Pfad, den man hier laden könnte, und ein
 * nachgeladener Webfont scheitert an der CSP. Das trifft die neue Sprache härter als die alte,
 * weil sie ihre Wirkung stärker aus der Serifenschrift zieht. Deshalb trägt das Bild sie über
 * die FORM: Papierton, Goldlinie, die runde Marke und die Pillenform der Merkmale.
 */
export const alt = `${BRAND.name} — ${BRAND.slogan}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PAPER = '#efeadd'
const INK = '#1a1a1a'
const INK_2 = '#2a2622'
const MUTED = '#7a746a'
const LINE = '#d8cfbc'
const GOLD = '#b08a2e'

const CHIPS = ['Ohne App', 'Ohne Anmeldung', 'DSGVO-konform']

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    // Jede Ebene trägt ihr `display` ausdrücklich: die Bilderzeugung kennt kein Standard-Flex
    // und bricht bei mehreren Kindern ohne Angabe ab.
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 88px',
        background: PAPER,
        color: INK,
      }}
    >
      {/* Die Marke: dieselbe runde Scheibe wie im Tab und in der Kopfleiste. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: INK,
            color: PAPER,
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          {BRAND.name.charAt(0)}
        </div>
        <div style={{ display: 'flex', fontSize: 44, letterSpacing: '-0.01em' }}>{BRAND.name}</div>
      </div>

      <div style={{ display: 'flex', width: 220, height: 2, background: GOLD, margin: '40px 0' }} />

      <div
        style={{
          display: 'flex',
          fontSize: 92,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
        }}
      >
        {BRAND.slogan}
      </div>

      <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 24, maxWidth: 900 }}>
        Fotos, Videos und Feedback — mit einem einzigen QR-Code.
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 48 }}>
        {CHIPS.map((chip) => (
          <div
            key={chip}
            style={{
              display: 'flex',
              border: `2px solid ${LINE}`,
              borderRadius: 999,
              background: '#ffffff',
              padding: '14px 30px',
              fontSize: 26,
              fontWeight: 600,
              color: INK_2,
            }}
          >
            {chip}
          </div>
        ))}
      </div>
    </div>,
    size,
  )
}
