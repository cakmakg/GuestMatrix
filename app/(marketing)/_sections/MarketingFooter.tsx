import Link from 'next/link'
import type { ReactElement } from 'react'

import { BRAND } from '@/lib/brand'
import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

import { Wordmark } from '../_components/Wordmark'

/**
 * Fußbereich: Marke, Wege, Pflichtangaben.
 *
 * Die Anlässe-Spalte kommt aus derselben Registry wie Hero, Laufband und Pakete — der Fuß kann
 * damit nicht in Vergessenheit geraten, wenn ein Sektor dazukommt.
 *
 * Der Fuß trägt ALLE Sprungmarken der Seite, auch die, die die Kopfleiste auf schmalen
 * Bildschirmen weglässt und die beiden, die dort gar nicht stehen (`#datenschutz`, `#faq`): hier
 * unten ist Platz, und wer bis hierhin gescrollt hat, sucht gezielt.
 *
 * ── Was aus der Vorlage NICHT übernommen ist ──────────────────────────────
 * - „Changelog", „AGB" und „Cookies": es gibt keine Seiten dafür. Ein Cookie-Hinweis ist zudem
 *   gar nicht fällig, solange die Seite nur technisch notwendige Cookies setzt (Supabase-Auth,
 *   `gm_last_active`) — das bleibt nur so, wenn keine Analyse-Skripte dazukommen (siehe den
 *   Datenschutz-Abschnitt, der genau das zusagt).
 * - „© 2026 Momento GmbH · Made in Berlin": die Rechtsform gehört ins Impressum und wird hier
 *   nicht erfunden — eine „Momento GmbH" gibt es so nicht. Ebenso wenig ist der Standort
 *   bestätigt.
 *
 * Die Rechtsspalte sagt „Datenschutzerklärung" und nicht kurz „Datenschutz": ein ABSCHNITT der
 * Startseite heißt so. Zwei gleich beschriftete Ziele, von denen eines eine Rechtsseite ist,
 * sind genau die Verwechslung, die man im Fuß nicht haben will.
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
        { label: 'Über', href: '#warum' },
        { label: 'Pakete', href: '#pakete' },
        { label: 'Ablauf', href: '#ablauf' },
        { label: 'Häufige Fragen', href: '#faq' },
      ],
    },
    {
      head: 'Anlässe',
      links: MARKETING_SEGMENTS.map((segment) => ({
        label: segment.useCase.title,
        href: '#pakete',
      })),
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
          <div>
            <Link href="/" className="gs-mkt-logo" aria-label={BRAND.name}>
              <Wordmark />
            </Link>
            <p className="gs-mkt-footer-claim">&bdquo;{BRAND.slogan}&ldquo;</p>
            <p className="gs-mkt-footer-text">
              Die QR-Plattform für Gäste-Momente — Fotos, Videos und Feedback an einem Ort.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.head}>
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

        <div className="gs-mkt-footer-bottom">
          <span>
            © {new Date().getFullYear()} {BRAND.name}
          </span>
          <Link href="/signup">Kostenlos starten ↗</Link>
        </div>
      </div>
    </footer>
  )
}
