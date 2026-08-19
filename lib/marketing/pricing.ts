import { PLANS, PLAN_TUPLE, type Plan } from '@/lib/plans'

/**
 * Der Preisabschnitt der Startseite — Kontingente aus der Tarif-Registry, Worte von hier.
 *
 * Dieselbe Trennung wie bei den Segmenten: `lib/plans` sagt, WELCHE Tarife es gibt und wie viel
 * sie erlauben; diese Datei sagt, wie darüber gesprochen wird. Ändert sich ein Kontingent, ändert
 * sich die Seite mit — niemand muss daran denken.
 *
 * Es steht bewusst KEIN Eurobetrag auf der Seite: Abrechnung gibt es noch nicht (kein Stripe,
 * `docs/vision.md` Punkt 2), und ein Preis, den niemand bezahlen kann, ist beim ersten Gespräch
 * eine Hypothek. „Auf Anfrage" ist in der Einführungsphase die ehrliche Angabe.
 */

/** „1 aktive Kampagne" / „20 aktive Kampagnen" — die Zahl kommt aus der Registry. */
function activeCampaignsLine(count: number): string {
  return `${count} aktive ${count === 1 ? 'Kampagne' : 'Kampagnen'}`
}

function contributionsLine(count: number): string {
  return `${count.toLocaleString('de-DE')} Beiträge je Kampagne`
}

type PlanCopy = {
  price: string
  priceNote: string
  /** Aussagen, die NICHT aus einem Kontingent folgen. */
  extras: readonly string[]
  ctaLabel: string
  /** Hebt den Tarif hervor, auf den das Gespräch zielt. */
  featured: boolean
}

const COPY: Record<Plan, PlanCopy> = {
  free: {
    price: 'Kostenlos',
    priceNote: 'Zum Ausprobieren · Keine Kreditkarte nötig',
    extras: ['Alle Funktionen deiner Geschäftsart', 'Einwilligung, Moderation & Löschpfad'],
    ctaLabel: 'Kostenlos starten',
    featured: false,
  },
  pro: {
    price: 'Auf Anfrage',
    priceNote: 'Individuell pro Betrieb · Kein Abo, das später überrascht',
    // „Individuelles Branding" aus der Vorlage ist zurückgenommen: gästeseitig erscheint heute
    // der bei der Registrierung erfasste Name (`tenants.brand_name`), kein Logo und keine Farben.
    extras: ['Dein Name für deine Gäste', 'Persönlicher Onboarding-Support'],
    // Kein „Demo vereinbaren": es gibt weder eine Demo noch eine Kontaktadresse im Produkt.
    // In der Einführungsphase schaltet der Betreiber Pro ohnehin von Hand frei.
    ctaLabel: 'Konto anlegen',
    featured: true,
  },
}

export type PricingTier = {
  plan: Plan
  label: string
  price: string
  priceNote: string
  /** Aus `lib/plans` abgeleitet — Eingabe des Tests. */
  quotas: readonly string[]
  extras: readonly string[]
  ctaLabel: string
  featured: boolean
}

export const PRICING_TIERS: readonly PricingTier[] = PLAN_TUPLE.map((plan): PricingTier => {
  const config = PLANS[plan]
  const copy = COPY[plan]
  return {
    plan,
    label: config.label,
    price: copy.price,
    priceNote: copy.priceNote,
    quotas: [
      activeCampaignsLine(config.maxActiveEvents),
      contributionsLine(config.maxUploadsPerEvent),
    ],
    extras: copy.extras,
    ctaLabel: copy.ctaLabel,
    featured: copy.featured,
  }
})
