import type { ReactElement } from 'react'

import type { SectorCardContent } from '@/lib/marketing/segments'

import { MktIcon } from './icons'
import { PhoneFrame } from './PhoneFrame'
import { QrMock } from './QrMock'

/**
 * Der Gäste-Ablauf im Hero: derselbe Bildschirm in drei Zuständen — scannen, hochladen, fertig.
 *
 * Sie ersetzt den Sektor-Wechsler der vorigen Fassung. Das ist der eine ECHTE Verlust des neuen
 * Entwurfs: der Hero zeigt nicht mehr alle Geschäftsarten nebeneinander, sondern einen Ablauf
 * an einem Beispiel. Getragen wird die Vielfalt jetzt vom Laufband und von den Paketen — und
 * die drei Panels erklären dafür etwas, das die Karte nie erklärt hat, nämlich was ein Gast
 * tatsächlich TUT.
 *
 * Der Gewinn nebenbei: die Startseite kommt ohne `"use client"` aus. Der Wechsler war die
 * einzige Insel; die drei Zustände laufen hier über CSS-Keyframes, also ohne eine Zeile
 * JavaScript im Bündel.
 *
 * Der Inhalt kommt aus der Registry (`MARKETING_SEGMENTS[0].card`) und nicht als Literal: dann
 * wirbt der Hero mit einer Kampagne, die es in der Registrierung auch gibt. Wird die erste
 * Geschäftsart abgeschaltet, rückt die nächste nach.
 *
 * Die Farbfelder statt Fotos sind Absicht, kein Platzhalter: ein Symbolfoto fremder Menschen
 * auf einer Seite, die mit Einwilligung wirbt, wäre das falsche erste Bild.
 */
export function GuestPhone({ card }: { card: SectorCardContent }): ReactElement {
  return (
    <PhoneFrame title={card.title}>
      {/* Zustand 1 — der QR-Code, wie ihn der Gast vor sich hat. */}
      <div className="gs-mkt-panel" data-panel="a">
        <p className="gs-mkt-panel-title">
          Teile deinen
          <br />
          Moment mit uns.
        </p>

        <div className="gs-mkt-qr">
          <QrMock />
          <div className="gs-mkt-qr-scan" />
        </div>

        {/* Was diese Kampagne annimmt — dieselben Angaben, die die Registry als Ansprüche führt
            (`claimsOfSegment`). Deshalb steht hier keine erfundene Liste. */}
        <div className="gs-mkt-panel-hints">
          {card.chips.map((chip) => (
            <span key={chip.label} data-state="on">
              {chip.label}
            </span>
          ))}
        </div>

        <p className="gs-mkt-panel-foot">
          {card.qrHint} — scanne mit deiner Kamera
          <strong>Kein App-Download nötig</strong>
        </p>
      </div>

      {/* Zustand 2 — der Beitrag geht raus. */}
      <div className="gs-mkt-panel" data-panel="b">
        <p className="gs-mkt-panel-title">Wird geteilt…</p>

        <div className="gs-mkt-upload-card">
          <div className="gs-mkt-upload-thumb">
            <span className="gs-mkt-upload-caption">Sonnenaufgang, Suite 12</span>
          </div>
        </div>

        <p className="gs-mkt-upload-meta">
          <span>IMG_2461.jpg · 2,4 MB</span>
          <strong>Hochladen…</strong>
        </p>

        <div className="gs-mkt-progress">
          <i />
        </div>

        <div className="gs-mkt-panel-hints">
          <span data-state="on">Verschlüsselt übertragen</span>
          {/* In der Vorlage stand hier „Speichern in Deutschland". Der Speicherort der
              Supabase-Instanz ist nicht bestätigt, und eine Aussage darüber ist im Zweifel ein
              Rechtsversprechen. Was stattdessen dasteht, ist im Code nachweisbar:
              `submissions.consent_at` ist not null — ohne Zustimmung entsteht keine Zeile. */}
          <span>Erst nach deiner Zustimmung</span>
        </div>
      </div>

      {/* Zustand 3 — der Dank und das, was daraus wird. */}
      <div className="gs-mkt-panel" data-panel="c">
        <div className="gs-mkt-done">
          <span className="gs-mkt-done-mark">
            <MktIcon name="check" size={16} bold />
          </span>
          <span className="gs-mkt-done-label">Geteilt</span>
        </div>

        <p className="gs-mkt-panel-lead">Dankeschön.</p>
        <p className="gs-mkt-panel-text">Dein Moment ist jetzt Teil von {card.title}.</p>

        <div className="gs-mkt-tiles">
          <div className="gs-mkt-tile" />
          <div className="gs-mkt-tile" />
          <div className="gs-mkt-tile" />
          <div className="gs-mkt-tile">+12</div>
        </div>

        <p className="gs-mkt-panel-cta">
          {card.ctaLabel} <strong>→</strong>
        </p>
      </div>
    </PhoneFrame>
  )
}
