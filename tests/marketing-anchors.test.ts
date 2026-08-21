import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { FAQ_ITEMS } from '@/lib/marketing/faq'

/**
 * Sprungmarken der Startseite — der eine Fehler, den man beim Umbauen NICHT sieht.
 *
 * Ein Menüpunkt, der auf einen Anker ohne Ziel zeigt, wirft keinen Fehler und meldet nichts: der
 * Klick tut einfach gar nichts. Für den Besucher sieht das aus wie eine kaputte Seite, für den
 * Entwickler nach gar nichts. Genau das passiert beim Umbenennen von Abschnitten — beim Wechsel
 * auf die Vorlage v3 sind aus `#loesung`, `#funktion` und `#anlaesse` die Anker `#warum`,
 * `#pakete` und `#ablauf` geworden, und Kopfleiste, Fuß und JSON-LD mussten alle drei mit.
 *
 * Der Test liest deshalb den QUELLTEXT der Fläche statt sie zu rendern: die Abschnitte sind
 * Server-Komponenten und die Testumgebung ist `node` (siehe vitest.config.ts) — ein Renderer
 * wäre für eine Frage, die rein statisch ist, der teurere Weg.
 */
const MARKETING_DIR = path.resolve(__dirname, '../app/(marketing)')

/**
 * Kommentare weg, bevor irgendetwas gezählt wird.
 *
 * Ohne diesen Schritt findet der Test seine eigenen Verbote in den Begründungen wieder: die
 * Abschnitte HALTEN in ihren Kopfkommentaren fest, dass „Demo ansehen" aus der Vorlage bewusst
 * nicht übernommen wurde — und genau dieser Satz ließe die Prüfung scheitern.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

/** Alle .tsx-Dateien der Fläche: Abschnitte, Bauteile und die Seiten selbst. */
function surfaceSource(): string {
  const roots = [
    path.join(MARKETING_DIR, '_sections'),
    path.join(MARKETING_DIR, '_components'),
    MARKETING_DIR,
  ]

  const parts: string[] = []
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue
      parts.push(stripComments(readFileSync(path.join(root, entry.name), 'utf8')))
    }
  }
  return parts.join('\n')
}

function matchAll(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  )
}

const SOURCE = surfaceSource()

// Ziele: `<section id="warum">`.
const TARGETS = new Set(matchAll(SOURCE, /\bid="([a-z][a-z0-9-]*)"/g))
// Absender: als JSX-Attribut (`href="#warum"`) UND als Objektfeld (`href: '#warum'`) — die
// Kopfleiste und der Fuß pflegen ihre Menüs als Datenlisten, nicht als Markup.
const LINKS = new Set(matchAll(SOURCE, /href(?:=|:\s*)["'`]#([a-z][a-z0-9-]*)["'`]/g))

describe('jede Sprungmarke der Startseite hat ein Ziel', () => {
  it('findet überhaupt Anker und Ziele', () => {
    // Schutz vor dem stillen Erfolg: ändert sich die Schreibweise im Markup, liefen die Tests
    // darunter sonst gegen zwei leere Mengen und wären immer grün.
    expect(LINKS.size).toBeGreaterThan(3)
    expect(TARGETS.size).toBeGreaterThan(3)
  })

  it.each([...LINKS])('#%s zeigt auf einen Abschnitt, den es gibt', (link) => {
    expect([...TARGETS]).toContain(link)
  })

  it.each(['warum', 'pakete', 'ablauf', 'datenschutz', 'faq'])(
    'der Abschnitt #%s ist vorhanden',
    (anchor) => {
      expect([...TARGETS]).toContain(anchor)
    },
  )
})

describe('die FAQ-Sprungmarken des JSON-LD stehen auch im Markup', () => {
  it('rendert jede Frage unter der ID, auf die das JSON-LD zeigt', () => {
    // `buildLandingJsonLd` verweist auf `#faq-<id>`. Der Abschnitt muss die IDs also aus
    // derselben Liste erzeugen — täte er es aus einer laufenden Nummer, zeigte die Suchmaschine
    // auf Stellen, die es nicht gibt.
    const faqSource = readFileSync(path.join(MARKETING_DIR, '_sections/Faq.tsx'), 'utf8')
    expect(faqSource).toContain('id={`faq-${item.id}`}')
    expect(faqSource).toContain('FAQ_ITEMS.map')
    expect(FAQ_ITEMS.length).toBeGreaterThan(0)
  })
})

describe('die Fläche bleibt frei von toten Wegen', () => {
  it('enthält keinen Link auf href="#"', () => {
    // Die Design-Vorlage setzt an mehreren Stellen `href="#"`: die Schritt-Überschriften des
    // Ablaufs und im Fuß „Changelog", „AGB" und „Cookies". Ein Link, der auf nichts zeigt, ist
    // auf einer verkaufenden Seite teurer als kein Link.
    expect(SOURCE).not.toMatch(/href(?:=|:\s*)["'`]#["'`]/)
  })

  it('verspricht keine Demo, solange es keine gibt', () => {
    // „Demo ansehen" im Hero und „Demo vereinbaren" im Schlussbanner der Vorlage.
    expect(SOURCE).not.toMatch(/Demo (ansehen|vereinbaren)/)
  })

  it('nennt weder Google noch TripAdvisor als Anbindung', () => {
    // Die Vorlage wirbt auf der Hotel-Kachel mit „Google & TripAdvisor Reviews" und stellt die
    // Kundenstimmen unter ein Google-Logo. Es gibt keine Anbindung an Bewertungsportale.
    expect(SOURCE).not.toMatch(/TripAdvisor/)
    expect(SOURCE).not.toMatch(/Google/)
  })
})
