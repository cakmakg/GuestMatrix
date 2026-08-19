import { describe, expect, it } from 'vitest'

import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { FAQ_ITEMS } from '@/lib/marketing/faq'
import { ICON_NAMES } from '@/lib/marketing/icons'
import { buildLandingJsonLd, serializeJsonLd } from '@/lib/marketing/json-ld'
import { PRICING_TIERS } from '@/lib/marketing/pricing'
import {
  MARKETING_SEGMENTS,
  capabilitiesForSegment,
  claimsOfSegment,
} from '@/lib/marketing/segments'
import { PLANS, PLAN_TUPLE } from '@/lib/plans'
import { CAMPAIGN_TYPES, FLOW_MODE_CAPABILITIES, SIGNUP_OPTIONS } from '@/lib/sectors'

// Die Startseite bewirbt Geschäftsarten und Tarife. Beides steht in Registries
// (`lib/sectors`, `lib/plans`), und beides ändert sich — ein Sektor wird geöffnet, ein
// Kontingent wird angehoben. Diese Tests halten fest, dass die Seite dann MITWÄCHST statt
// still falsch zu werden.

describe('Segmente folgen der Registrierungs-Auswahl', () => {
  it('deckt jede aktive Geschäftsart ab, in derselben Reihenfolge', () => {
    // Deckungslücke = jemand hat einen Sektor aktiviert und die Startseite vergessen. Die Seite
    // bleibt dann zwar heil (unbekannte Optionen werden übersprungen), bewürbe die neue
    // Geschäftsart aber nicht — dieser Test ist das Signal dafür.
    expect(MARKETING_SEGMENTS.map((segment) => segment.option.value)).toEqual(
      SIGNUP_OPTIONS.map((option) => option.value),
    )
  })

  it('bewirbt heute genau Hotel, Reiseagentur und Hochzeit/Event', () => {
    expect(MARKETING_SEGMENTS.map((segment) => segment.navLabel)).toEqual([
      'Hotels',
      'Reisen',
      'Hochzeiten',
    ])
  })

  it('gibt jedem Segment eine eigene Akzentfarbe', () => {
    const accents = MARKETING_SEGMENTS.map((segment) => segment.card.accent)
    expect(new Set(accents).size).toBe(accents.length)
  })

  it('benennt nur Symbole, die es auch gibt', () => {
    const used = MARKETING_SEGMENTS.flatMap((segment) => [
      segment.card.icon,
      ...segment.card.chips.map((chip) => chip.icon),
    ])
    for (const icon of used) {
      expect(ICON_NAMES).toContain(icon)
    }
  })
})

// Der eigentliche Fehlerfall: die Design-Vorlage warb auf der Hochzeits-Karte mit „Ein Album für
// alle" und mit einem „Story"-Format. Das Gästebuch hat aber weder Galerie noch Bewertung
// (FLOW_MODE_CAPABILITIES), und ein Story-Format gibt es nirgends. Solche Sätze fallen beim
// Lesen niemandem auf — hier fallen sie auf.
describe('kein Segment verspricht, was seine Flow-Modi nicht können', () => {
  it.each(MARKETING_SEGMENTS.map((segment) => ({ label: segment.navLabel, segment })))(
    '$label erhebt nur Ansprüche, die die Registry deckt',
    ({ segment }) => {
      const capabilities = capabilitiesForSegment(segment)
      for (const claim of claimsOfSegment(segment)) {
        expect(capabilities[claim]).toBe(true)
      }
    },
  )

  it('das Gästebuch wirbt weder mit Bewertung noch mit Galerie', () => {
    const guestbook = MARKETING_SEGMENTS.find((segment) => segment.option.sector === 'event')
    expect(guestbook).toBeDefined()
    if (!guestbook) return

    const capabilities = capabilitiesForSegment(guestbook)
    expect(capabilities.ratingEnabled).toBe(false)
    expect(capabilities.galleryEnabled).toBe(false)

    const claims = claimsOfSegment(guestbook)
    expect(claims).not.toContain('ratingEnabled')
    expect(claims).not.toContain('galleryEnabled')
  })

  it('bewirbt eine Galerie heute nur bei der Reiseagentur', () => {
    // Der einzige aktive gallery-Flow (Kampagnentyp `agency`). Hotel läuft im Feedback-Modus,
    // die Hochzeit im geschlossenen Gästebuch — beide haben keine Galerie zu zeigen.
    const withGallery = MARKETING_SEGMENTS.filter((segment) =>
      claimsOfSegment(segment).includes('galleryEnabled'),
    )
    expect(withGallery.map((segment) => segment.navLabel)).toEqual(['Reisen'])
  })
})

describe('Preise folgen der Tarif-Registry', () => {
  it('zeigt jeden Tarif genau einmal, in der Reihenfolge der Registry', () => {
    expect(PRICING_TIERS.map((tier) => tier.plan)).toEqual([...PLAN_TUPLE])
  })

  it('übernimmt die Kontingente aus lib/plans statt sie zu wiederholen', () => {
    for (const tier of PRICING_TIERS) {
      const config = PLANS[tier.plan]
      expect(tier.label).toBe(config.label)
      expect(tier.quotas[0]).toContain(String(config.maxActiveEvents))
      // Tausendertrennung nach deutscher Schreibweise (3000 → „3.000").
      expect(tier.quotas[1]).toContain(config.maxUploadsPerEvent.toLocaleString('de-DE'))
    }
  })

  it('nennt Singular und Plural richtig', () => {
    const free = PRICING_TIERS.find((tier) => tier.plan === 'free')
    expect(free?.quotas[0]).toBe('1 aktive Kampagne')
    const pro = PRICING_TIERS.find((tier) => tier.plan === 'pro')
    expect(pro?.quotas[0]).toBe('20 aktive Kampagnen')
  })

  it('nennt keinen Eurobetrag, solange es keine Abrechnung gibt', () => {
    // Es gibt kein Stripe (docs/vision.md, Punkt 2). Ein Preis auf der Seite wäre ein
    // Versprechen ohne Kasse dahinter.
    const text = PRICING_TIERS.flatMap((tier) => [
      tier.price,
      tier.priceNote,
      ...tier.quotas,
      ...tier.extras,
    ]).join(' ')
    expect(text).not.toMatch(/[€$]|\bEUR\b/)
  })

  it('hebt genau einen Tarif hervor', () => {
    expect(PRICING_TIERS.filter((tier) => tier.featured)).toHaveLength(1)
  })
})

// ─── Dilim C: FAQ, strukturierte Daten, robots/sitemap ───────────────────────
// Die FAQ steht zweimal auf der Seite: sichtbar im Abschnitt und maschinenlesbar im JSON-LD.
// Google verlangt, dass beides wörtlich übereinstimmt — und genau das läuft beim Nachbessern
// auseinander, wenn es niemand prüft. Dazu zwei Aussagen, die die Registry betreffen (Export,
// Kontingente), und die robots-Regel, die Gästeseiten aus dem Index hält.

/** Schmales Prädikat für die Knoten des JSON-LD-Graphen — er ist bewusst als Datenwert typisiert. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('FAQ und strukturierte Daten sind eine Quelle', () => {
  it('gibt jeder Frage eine eigene, stabile Sprungmarke', () => {
    const ids = FAQ_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('nennt die Kontingente aus lib/plans statt eigener Zahlen', () => {
    const preis = FAQ_ITEMS.find((item) => item.id === 'preis')
    expect(preis).toBeDefined()
    expect(preis?.answer).toContain(String(PLANS.free.maxActiveEvents))
    expect(preis?.answer).toContain(PLANS.free.maxUploadsPerEvent.toLocaleString('de-DE'))
    expect(preis?.answer).toContain(PLANS.pro.label)
  })

  it('das JSON-LD gibt genau die sichtbaren Antworten wieder', () => {
    const graph = buildLandingJsonLd('https://example.test')['@graph']
    expect(Array.isArray(graph)).toBe(true)
    if (!Array.isArray(graph)) return

    const faqPage = graph.find((node) => isRecord(node) && node['@type'] === 'FAQPage')
    expect(isRecord(faqPage)).toBe(true)
    if (!isRecord(faqPage)) return

    const questions = faqPage.mainEntity
    expect(Array.isArray(questions)).toBe(true)
    if (!Array.isArray(questions)) return

    // Reihenfolge UND Wortlaut: eine gekürzte Fassung im JSON-LD wäre bei Google ein Verstoß.
    expect(questions).toHaveLength(FAQ_ITEMS.length)
    questions.forEach((node, index) => {
      expect(isRecord(node)).toBe(true)
      if (!isRecord(node)) return

      expect(node.name).toBe(FAQ_ITEMS[index]?.question)

      const answer = node.acceptedAnswer
      expect(isRecord(answer)).toBe(true)
      if (!isRecord(answer)) return

      expect(answer.text).toBe(FAQ_ITEMS[index]?.answer)
    })
  })

  it('nennt die Startseite unter der übergebenen Adresse', () => {
    const graph = buildLandingJsonLd('https://momento.test')['@graph']
    expect(JSON.stringify(graph)).toContain('https://momento.test/')
  })

  it('kann das Script-Element nicht verlassen', () => {
    // Ein Text mit „</script>" würde das Element sonst vorzeitig schließen.
    const serialized = serializeJsonLd({
      name: '</script><img onerror=alert(1)>',
    })
    expect(serialized).not.toContain('<')
    expect(JSON.parse(serialized)).toEqual({
      name: '</script><img onerror=alert(1)>',
    })
  })
})

describe('die FAQ verspricht nur, was die Registry deckt', () => {
  it('Export: Feedback und Galerie ja, Gästebuch nein', () => {
    // Die Antwort auf „Komme ich an die Inhalte …" sagt genau das. Wird der Export je für das
    // Gästebuch geöffnet (oder für einen der anderen Modi geschlossen), ist der Satz falsch.
    expect(FLOW_MODE_CAPABILITIES.feedback.exportEnabled).toBe(true)
    expect(FLOW_MODE_CAPABILITIES.gallery.exportEnabled).toBe(true)
    expect(FLOW_MODE_CAPABILITIES.guestbook.exportEnabled).toBe(false)

    const answer = FAQ_ITEMS.find((item) => item.id === 'export')?.answer ?? ''
    expect(answer).toContain('Gästebuch')
  })

  it('Sichtbarkeit: das Gästebuch bleibt geschlossen', () => {
    // Die Antwort sagt „ausschließlich an den Veranstalter". Das stimmt nur, solange die
    // Sichtbarkeitswahl zu ist (Migration 0021 ist da, der Gäste-Bildschirm fehlt).
    expect(CAMPAIGN_TYPES.wedding?.allowVisibilityChoice ?? false).toBe(false)
  })
})

describe('robots.txt und sitemap.xml', () => {
  it('hält Gästeseiten, Dashboard und API aus dem Index', () => {
    const rules = robots().rules
    const list = Array.isArray(rules) ? rules : [rules]
    const disallow = list.flatMap((rule) => {
      const value = rule.disallow ?? []
      return Array.isArray(value) ? value : [value]
    })

    // `/e/` ist der wichtigste Eintrag: dort liegen Gästemedien, also personenbezogene Daten.
    expect(disallow).toContain('/e/')
    expect(disallow).toContain('/dashboard/')
    expect(disallow).toContain('/api/')
  })

  it('verweist auf eine absolute Sitemap-Adresse', () => {
    const value = robots().sitemap
    const first = Array.isArray(value) ? value[0] : value
    expect(first).toMatch(/^https?:\/\/.+\/sitemap\.xml$/)
  })

  it('listet nur die Startseite — keine noindex-Seite, keine Gästeseite', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls).toHaveLength(1)
    expect(urls[0]).toMatch(/^https?:\/\/[^/]+\/$/)
    for (const url of urls) {
      expect(url).not.toContain('/e/')
      expect(url).not.toContain('/impressum')
      expect(url).not.toContain('/datenschutz')
    }
  })
})
