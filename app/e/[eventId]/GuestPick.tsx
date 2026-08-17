'use client'

import type { ChangeEvent } from 'react'

/**
 * Welche Dateitypen der Auswahldialog anbietet.
 *
 * Spiegelt bewusst `ALLOWED_MIME_TYPES` (lib/validation/schemas.ts) als Literal, statt es zu
 * importieren: dieses Modul liegt im Client-Bundle der QR-Seite, und der Import zöge das ganze
 * Schema-Modul samt zod auf ein Telefon, das gerade nur einen Dateidialog öffnen will. Die
 * Autorität bleibt der Server — `accept` ist ein Vorschlag an das Betriebssystem, keine Prüfung
 * (presign validiert den MIME-Typ, danach prüft der Server die Magic Bytes).
 */
export const MEDIA_ACCEPT = 'image/jpeg,image/png,video/mp4,video/quicktime'

type Props = {
  /** Überschrift des Feldes. Fehlt sie, ist die Auswahl selbst die Beschriftung (optionale Medien). */
  label?: string
  /** Text der leeren Fläche — trägt zugleich den zugänglichen Namen des Feldes. */
  empty: string
  /** Was gewählt IST (Dateiname oder „3 Dateien"), sonst null. */
  chosen: string | null
  hint: string
  multiple?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Dateiauswahl des Gäste-Flows — eine Stelle für alle drei Flows.
 *
 * Ein <label> mit unsichtbarem, aber FOKUSSIERBAREM Feld. Vorher war die Fläche ein `<div
 * onClick>`: mit der Maus bedienbar, mit der Tastatur überhaupt nicht, und für einen Screenreader
 * kein Bedienelement — nur Text, der zufällig auf Klicks reagierte.
 */
export function GuestPick({ label, empty, chosen, hint, multiple = false, onChange }: Props) {
  return (
    <div className="gs-guest-field">
      {label && <p className="gs-guest-label">{label}</p>}
      <label className="gs-guest-pick">
        <span className="gs-guest-pick-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10.5" r="1.5" />
            <path d="M21 16l-5-5-9 8" />
          </svg>
        </span>
        <span className={chosen ? 'gs-guest-pick-name' : undefined}>{chosen ?? empty}</span>
        <input
          type="file"
          accept={MEDIA_ACCEPT}
          multiple={multiple}
          onChange={onChange}
          // Der zugängliche Name kommt aus dem Text des <label>; bei gewählter Datei ist das der
          // Dateiname, und „Bild.jpg" allein sagt nicht, was der Knopf tut.
          aria-label={empty}
        />
      </label>
      <p className="gs-guest-hint">{hint}</p>
    </div>
  )
}
