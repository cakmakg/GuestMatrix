import type { Metadata } from 'next'
import type { ReactElement } from 'react'

export const metadata: Metadata = {
  title: 'Impressum',
  // Ein leeres Pflichtdokument soll nicht in den Index geraten.
  robots: { index: false, follow: true },
}

/**
 * Impressum — PFLICHTANGABE nach § 5 DDG, noch ohne Inhalt.
 *
 * Die Gliederung steht, der Inhalt kommt vom Betreiber: Rechtsform, Anschrift, vertretungs-
 * berechtigte Person, Registereintrag und Umsatzsteuer-ID sind Angaben über das Unternehmen und
 * werden hier NICHT erfunden. Die Seite existiert trotzdem schon, damit der Verweis im
 * Fußbereich nicht ins Leere führt.
 *
 * Vor dem öffentlichen Start ausfüllen — ohne vollständiges Impressum ist die Seite in
 * Deutschland abmahnfähig.
 */
export default function ImpressumPage(): ReactElement {
  return (
    <div className="gs-mkt-shell">
      <article className="gs-mkt-prose">
        <h1>Impressum</h1>
        <p>
          <strong>Diese Seite ist noch nicht ausgefüllt.</strong> Die Pflichtangaben werden vor dem
          öffentlichen Start ergänzt.
        </p>

        <h2>Angaben gemäß § 5 DDG</h2>
        <p>Firmierung, Rechtsform und Anschrift.</p>

        <h2>Kontakt</h2>
        <p>Telefonnummer und E-Mail-Adresse.</p>

        <h2>Vertreten durch</h2>
        <p>Vertretungsberechtigte Person.</p>

        <h2>Registereintrag &amp; Umsatzsteuer-ID</h2>
        <p>Registergericht, Registernummer und USt-IdNr. gemäß § 27 a UStG.</p>

        <h2>Verantwortlich für den Inhalt</h2>
        <p>Name und Anschrift der verantwortlichen Person.</p>
      </article>
    </div>
  )
}
