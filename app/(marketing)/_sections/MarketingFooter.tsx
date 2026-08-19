import Link from 'next/link'
import type { ReactElement } from 'react'

import { BRAND } from '@/lib/brand'
import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

/**
 * Fußbereich: Marke, Wege, Pflichtangaben.
 *
 * Die Anlässe-Spalte kommt aus derselben Registry wie der Hero-Wechsler und die Karten weiter
 * oben — der Fuß kann damit nicht in Vergessenheit geraten, wenn ein Sektor dazukommt.
 *
 * Der Fuß trägt ALLE Sprungmarken der Seite, auch die, die die Kopfleiste auf schmalen
 * Bildschirmen weglässt: hier unten ist Platz, und wer bis hierhin gescrollt hat, sucht gezielt.
 *
 * „Changelog", „AGB" und „Cookies" aus der Vorlage fehlen: es gibt keine Seiten dafür. Ein
 * Cookie-Hinweis ist zudem gar nicht fällig, solange die Seite nur technisch notwendige Cookies
 * setzt (Supabase-Auth, `gm_last_active`) — das bleibt nur so, wenn keine Analyse-Skripte
 * dazukommen (siehe den Datenschutz-Abschnitt, der genau das zusagt).
 *
 * Die Rechtsspalte sagt „Datenschutzerklärung" und nicht mehr kurz „Datenschutz": seit Dilim C
 * heißt ein ABSCHNITT der Startseite so. Zwei gleich beschriftete Ziele, von denen eines eine
 * Rechtsseite ist, sind genau die Verwechslung, die man im Fuß nicht haben will.
 */
type FooterColumn = {
  head: string
  links: readonly { label: string; href: string }[]
}

export function MarketingFooter(): ReactElement {
  const columns: readonly FooterColumn[] = [
    {
      head: 'Produkt',
      links: [
        { label: 'Lösung', href: '#loesung' },
        { label: 'So funktioniert’s', href: '#funktion' },
        { label: 'Anlässe', href: '#anlaesse' },
        { label: 'Preise', href: '#preise' },
        { label: 'Häufige Fragen', href: '#faq' },
      ],
    },
    {
      head: 'Anlässe',
      links: MARKETING_SEGMENTS.map((segment) => ({
        label: segment.useCase.title,
        href: '#anlaesse',
      })),
    },
    {
      head: 'Konto',
      links: [
        { label: 'Kostenlos starten', href: '/signup' },
        { label: 'Anmelden', href: '/login' },
      ],
    },
    {
      head: 'Rechtliches',
      links: [
        { label: 'Datenschutz auf einen Blick', href: '#datenschutz' },
        { label: 'Impressum', href: '/impressum' },
        { label: 'Datenschutzerklärung', href: '/datenschutz' },
      ],
    },
  ]

  return (
    <footer className="gs-mkt-footer">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-footer-grid">
          <div className="gs-mkt-footer-brand">
            <Link href="/" className="gs-mkt-logo">
              {BRAND.name}
              <span>.</span>
            </Link>
            <p className="gs-mkt-footer-claim">
              Die QR-Plattform für Gästeerlebnisse — Fotos, Videos und Feedback an einem Ort.
            </p>
            <div className="gs-mkt-swatches" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.head} className="gs-mkt-footer-col">
              <h2 className="gs-mkt-footer-head">{column.head}</h2>
              <div className="gs-mkt-footer-links">
                {column.links.map((link) => (
                  <Link key={`${column.head}-${link.label}`} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Die Rechtsform gehört ins Impressum und wird hier NICHT erfunden — die Vorlage nannte
            eine „Momento GmbH", die es so nicht gibt. */}
        <div className="gs-mkt-footer-bottom">
          <span>
            © {new Date().getFullYear()} {BRAND.name}
          </span>
          <span>{BRAND.slogan}</span>
        </div>
      </div>
    </footer>
  )
}
