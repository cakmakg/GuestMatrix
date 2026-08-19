import type { Metadata } from 'next'
import type { ReactElement } from 'react'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  robots: { index: false, follow: true },
}

/**
 * Datenschutzerklärung — noch ohne Inhalt.
 *
 * Die Gliederung nimmt vorweg, was dieses Produkt tatsächlich verarbeitet, damit der Text später
 * nicht an der Software vorbeigeschrieben wird: Gästemedien sind personenbezogene Daten, die
 * Einwilligung wird mit Zeitstempel gespeichert (`consent_at`), es gibt einen Löschpfad, und der
 * Kunde ist Verantwortlicher, während der Betreiber Auftragsverarbeiter ist.
 *
 * Offen und vor dem Start zu klären: Auftragsverarbeitungsvertrag nach Art. 28 DSGVO für die
 * Kunden, Liste der Unterauftragsverarbeiter (Hosting, Datenbank/Storage) und deren
 * Verarbeitungsorte. Der Rechtstext selbst kommt vom Betreiber.
 */
export default function DatenschutzPage(): ReactElement {
  return (
    <div className="gs-mkt-shell">
      <article className="gs-mkt-prose">
        <h1>Datenschutzerklärung</h1>
        <p>
          <strong>Diese Seite ist noch nicht ausgefüllt.</strong> Der Text wird vor dem öffentlichen
          Start ergänzt.
        </p>

        <h2>Verantwortlicher</h2>
        <p>Wer die Verarbeitung auf dieser Website verantwortet.</p>

        <h2>Verarbeitung beim Besuch dieser Website</h2>
        <p>Server-Logs, technisch notwendige Cookies, Aufbewahrungsdauer.</p>

        <h2>Konto und Anmeldung</h2>
        <p>Welche Daten bei der Registrierung erhoben werden und wozu.</p>

        <h2>Gästebeiträge</h2>
        <p>
          Fotos, Videos, Bewertungen und Kommentare; Rechtsgrundlage Einwilligung, Zeitpunkt der
          Einwilligung, Moderation und Löschung.
        </p>

        <h2>Auftragsverarbeitung</h2>
        <p>Rollenverteilung zwischen Kunde und Betreiber, eingesetzte Dienstleister.</p>

        <h2>Deine Rechte</h2>
        <p>Auskunft, Berichtigung, Löschung, Widerspruch, Beschwerde bei einer Aufsichtsbehörde.</p>
      </article>
    </div>
  )
}
