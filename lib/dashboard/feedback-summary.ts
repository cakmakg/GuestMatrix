/**
 * Aggregation der strukturierten Feedback-Antworten (`submissions.feedback_answers`).
 *
 * Der Fragenkatalog kommt IMMER aus der Sektor-Registry (`lib/sectors`), nie aus den Daten:
 * so bleibt die Reihenfolge stabil und eine Frage ohne Antworten verschwindet nicht still
 * aus dem Bericht. Antworten zu Schlüsseln, die nicht mehr im Katalog stehen, werden
 * ignoriert — der Bericht zeigt den heutigen Katalog, nicht historische Schlüssel.
 *
 * Rein (keine DB, kein Next-Runtime), damit die Rechnung ohne Supabase testbar ist.
 */

import type { FeedbackQuestion } from '@/lib/sectors'
import { allowedCampaignTypes, getFeedbackQuestions, isBusinessType, isSector } from '@/lib/sectors'

export type AnswerSet = Record<string, number | string>

export type DimensionSummary = {
  id: string
  prompt: string
  /** `null`, solange niemand diese Frage beantwortet hat — nicht 0. */
  average: number | null
  responses: number
}

/**
 * Fragenkatalog eines Tenants, abgeleitet aus (sector, business_type) über die Registry —
 * der einzige Ableitungspunkt für Berichte UND Feedback-Liste, damit beide Seiten dieselben
 * Bereiche in derselben Reihenfolge zeigen. Mehrere erlaubte Kampagnentypen werden vereinigt;
 * eine doppelte Frage-ID (z. B. `value`) erscheint nur einmal. Unbekannte DB-Strings →
 * leerer Katalog, kein Sonderfall-Code.
 */
export function resolveQuestionCatalog(
  sector: string | null | undefined,
  businessType: string | null | undefined,
): FeedbackQuestion[] {
  if (!sector || !isSector(sector)) return []

  const resolvedBusinessType = businessType && isBusinessType(businessType) ? businessType : null

  const seen = new Set<string>()
  const catalog: FeedbackQuestion[] = []

  for (const type of allowedCampaignTypes(sector, resolvedBusinessType)) {
    for (const question of getFeedbackQuestions(type)) {
      if (seen.has(question.id)) continue
      seen.add(question.id)
      catalog.push(question)
    }
  }

  return catalog
}

/**
 * Engt einen `Json`-Wert aus der DB auf ein flaches Antwort-Objekt ein. Alles, was kein
 * Objekt ist (Array, Skalar, null), liefert ein leeres Set; verschachtelte Werte werden
 * verworfen, weil der Katalog nur Zahlen und kurze Texte kennt.
 */
export function parseAnswers(value: unknown): AnswerSet {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}

  const out: AnswerSet = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number' || typeof raw === 'string') out[key] = raw
  }
  return out
}

/**
 * Die Fragen, auf die dieser Beitrag tatsächlich geantwortet hat — in Katalog-Reihenfolge.
 *
 * „Beantwortet" heißt: ein Wert liegt vor, gleich welchen Typs. Die Antwortliste prüfte früher
 * auf `typeof === 'number'` und verschluckte damit JEDE Text-Antwort — im Gästebuch also die
 * einzige strukturierte Frage („Beschreibt die Feier in drei Worten"). Sie stand in der DB und
 * war im Dashboard unsichtbar.
 *
 * Leere Strings zählen nicht als Antwort: sie entstehen, wenn ein Gast das Feld anfasst und
 * wieder leert, und ergäben ein Etikett ohne Inhalt.
 */
export function answeredQuestions(
  answers: AnswerSet,
  questions: readonly FeedbackQuestion[],
): FeedbackQuestion[] {
  return questions.filter((question) => {
    const value = answers[question.id]
    if (typeof value === 'string') return value.trim() !== ''
    return typeof value === 'number'
  })
}

/**
 * Mittelwert je Rating-Frage. `text`-Fragen (z. B. Hochzeit „drei Worte") haben keinen
 * Mittelwert und bleiben draußen.
 */
export function summarizeDimensions(
  answerSets: readonly AnswerSet[],
  questions: readonly FeedbackQuestion[],
): DimensionSummary[] {
  return questions
    .filter((question) => question.type === 'rating')
    .map((question) => {
      const values = answerSets
        .map((set) => set[question.id])
        .filter((value): value is number => typeof value === 'number')

      return {
        id: question.id,
        prompt: question.prompt,
        responses: values.length,
        average: values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null,
      }
    })
}

/** Verteilung auf 1–5 Sterne. Index 0 = 1 Stern. Werte außerhalb 1–5 werden ignoriert. */
export function ratingDistribution(ratings: readonly number[]): number[] {
  const buckets = [0, 0, 0, 0, 0]
  for (const rating of ratings) {
    const index = Math.round(rating) - 1
    if (index >= 0 && index < 5) buckets[index] = (buckets[index] ?? 0) + 1
  }
  return buckets
}

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Anteil kritischer Bewertungen in Prozent. `threshold` ist inklusiv (<= 2 gilt als kritisch).
 * Ohne Bewertungen gibt es keine Quote — dann `null`, nicht 0.
 */
export function negativeShare(ratings: readonly number[], threshold = 2): number | null {
  if (ratings.length === 0) return null
  const critical = ratings.filter((rating) => rating <= threshold).length
  return (critical / ratings.length) * 100
}

/** Schwächste Dimension mit ausreichender Datenbasis — der Aufhänger für „was tun?". */
export function weakestDimension(
  summaries: readonly DimensionSummary[],
  minResponses = 1,
): DimensionSummary | null {
  const eligible = summaries.filter(
    (summary): summary is DimensionSummary & { average: number } =>
      summary.average !== null && summary.responses >= minResponses,
  )
  if (eligible.length === 0) return null

  return eligible.reduce((worst, current) => (current.average < worst.average ? current : worst))
}
