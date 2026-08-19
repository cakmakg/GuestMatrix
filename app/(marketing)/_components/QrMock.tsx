import type { ReactElement } from 'react'

/**
 * Das QR-Muster in der Produktkarte des Hero.
 *
 * ACHTUNG — dies ist ein BILD, kein Code: das Muster stammt aus der Design-Vorlage und kodiert
 * nichts. Es steht in einer Attrappe, die zeigt, wie eine Kampagne im Produkt aussieht, und ist
 * deshalb `aria-hidden`.
 *
 * Sobald die Domain feststeht, kann hier ein echter Code stehen — `qrcode` ist bereits
 * Abhängigkeit (siehe app/dashboard/qr/page.tsx) und `QRCode.create(url).modules` liefert
 * dieselbe Bitmatrix, die diese Datei als Zeichenketten mitbringt. Bis dahin bewusst ein Muster
 * und kein Code, der ins Leere führt.
 *
 * Als Zeilenmaske statt als 117 einzelne <rect>-Elemente: dieselbe Zeichnung, aber lesbar und
 * in einem Bildschirm überschaubar.
 */
const QR_ROWS = [
  '111111101011011111111',
  '100000100100101000001',
  '101110101011011011101',
  '101110100101101011101',
  '101110101010011011101',
  '100000100101001000001',
  '111111101010111111111',
  '000000000000000000000',
  '101010100110100101011',
  '010101001001001010100',
  '101010110100110101010',
  '010101001010001010101',
  '100010110101010101010',
  '000000000000000000000',
  '111111101010101010101',
  '100000100101010101010',
  '101110101010101010101',
  '101110100101010101010',
  '101110101010101010101',
  '100000100101010101010',
  '111111101010101010101',
] as const

export function QrMock(): ReactElement {
  return (
    <svg viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="21" height="21" fill="#fff" />
      <g fill="#2d3235">
        {QR_ROWS.map((row, y) =>
          row
            .split('')
            .map((module, x) =>
              module === '1' ? <rect key={`${y}-${x}`} x={x} y={y} width="1" height="1" /> : null,
            ),
        )}
      </g>
    </svg>
  )
}
