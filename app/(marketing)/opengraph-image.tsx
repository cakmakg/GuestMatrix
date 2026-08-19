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
 * Zur Schrift: hier steht die Standardschrift der Bilderzeugung, nicht Space Grotesk. Die
 * Schriften der Seite kommen über `next/font` und liegen nach dem Build als Dateien mit
 * Prüfsummen-Namen — es gibt keinen stabilen Pfad, den man hier laden könnte, und ein
 * nachgeladener Webfont scheitert an der CSP. Ein Bild in der Zweitschrift ist der kleinere
 * Preis; die Form (Papier, Streifen, harte Kanten) trägt die Marke ohnehin deutlicher als die
 * Buchstabenform.
 */
export const alt = `${BRAND.name} — ${BRAND.slogan}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PAPER = '#efeadd'
const INK = '#2d3235'
const MUTED = '#5a5f63'
const RED = '#c24b46'
const ORANGE = '#d67035'
const YELLOW = '#e8b056'

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
        background: PAPER,
        color: INK,
      }}
    >
      <div style={{ display: 'flex', width: '100%' }}>
        {[RED, ORANGE, YELLOW, INK].map((color) => (
          <div key={color} style={{ height: 20, flex: 1, background: color }} />
        ))}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 80px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 104, fontWeight: 700, letterSpacing: '-0.03em' }}>
          <span style={{ color: RED }}>{BRAND.name}</span>
          <span style={{ color: INK }}>.</span>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 52,
            fontWeight: 600,
            marginTop: 12,
            letterSpacing: '-0.02em',
          }}
        >
          {BRAND.slogan}
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 20 }}>
          Fotos, Videos und Feedback — mit einem einzigen QR-Code.
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 44 }}>
          {CHIPS.map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                border: `3px solid ${INK}`,
                background: '#ffffff',
                padding: '12px 22px',
                fontSize: 26,
                fontWeight: 600,
                boxShadow: `6px 6px 0 ${INK}`,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    </div>,
    size,
  )
}
