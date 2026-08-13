'use client'

import { useState } from 'react'

type Props = {
  qrDataUrl: string
  guestUrl: string
}

/**
 * QR-Code der Kampagne mit den beiden Handlungen, die der Betreiber wirklich braucht:
 * Bild herunterladen (ausdrucken, aufstellen) und Link kopieren (verschicken).
 *
 * Die Rückmeldung zum Kopieren steht im Knopf selbst statt in einem `alert()`. Ein Alert
 * blockiert die Seite bis zum Wegtippen — auf dem Telefon ein voller Bildschirm für die
 * Nachricht „kopiert". Der Zustand fällt nach zwei Sekunden von selbst zurück.
 */
export default function QrSection({ qrDataUrl, guestUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(guestUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ohne Zwischenablage-Recht (unsicherer Kontext, ältere Browser) bleibt der Link darunter
      // sichtbar und lässt sich von Hand markieren — deshalb hier kein Fehlerdialog.
      setCopied(false)
    }
  }

  return (
    <section className="gs-panel" style={{ alignItems: 'center', gap: 12 }}>
      <h3 style={{ fontSize: 20, margin: 0, alignSelf: 'flex-start' }}>QR-Code für Gäste</h3>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrDataUrl}
        alt="QR-Code für den Gäste-Link"
        style={{ width: '100%', maxWidth: 180, height: 'auto', display: 'block' }}
      />

      <div style={{ display: 'flex', gap: 8, width: '100%', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleCopy}
          className="btn btn-secondary"
          style={{ flex: '1 1 120px', justifyContent: 'center', minHeight: 44 }}
        >
          {copied ? 'Kopiert' : 'Link kopieren'}
        </button>
        <a
          href={qrDataUrl}
          download="qr-code.png"
          className="btn btn-primary"
          style={{ flex: '1 1 120px', justifyContent: 'center', minHeight: 44 }}
        >
          PNG laden
        </a>
      </div>

      <p
        style={{
          fontSize: 11,
          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          wordBreak: 'break-all',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {guestUrl}
      </p>
    </section>
  )
}
