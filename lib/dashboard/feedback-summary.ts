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

// ─── Text-Antworten (z. B. Hochzeit „drei Worte") ─────────────────────────────

export type TextAnswerSummary = {
  id: string
  prompt: string
  /** Die Antworten in Eingabereihenfolge, leere/nur-Leerzeichen sind bereits entfernt. */
  answers: string[]
}

/**
 * Sammelt die freien Kurzantworten je `text`-Frage.
 *
 * Gegenstück zu summarizeDimensions: dort wird gemittelt, hier gibt es nichts zu mitteln — der
 * Wert dieser Frage liegt im Wortlaut. Der Katalog bestimmt (wie dort) Auswahl und Reihenfolge,
 * damit eine unbeantwortete Frage sichtbar leer bleibt statt still zu verschwinden.
 */
export function summarizeTextAnswers(
  answerSets: readonly AnswerSet[],
  questions: readonly FeedbackQuestion[],
): TextAnswerSummary[] {
  return questions
    .filter((question) => question.type === 'text')
    .map((question) => ({
      id: question.id,
      prompt: question.prompt,
      answers: answerSets
        .map((set) => set[question.id])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value !== ''),
    }))
}

export type WordCount = { word: string; count: number }

/** Ein Wort muss mindestens so lang sein, um gezählt zu werden — filtert „&", „u.", „zu". */
const MIN_WORD_LENGTH = 3

/**
 * Häufigste Wörter über alle Antworten — das „drei Worte"-Bild einer Feier.
 *
 * Normalisiert wird auf Kleinschreibung ohne Satzzeichen; Umlaute und ß bleiben erhalten
 * (sonst würden „schön" und „schon" zusammenfallen). Gezählt wird pro Antwort nur EINMAL je
 * Wort: schreibt ein Gast „schön, schön, schön", soll das nicht wie drei Stimmen wirken.
 *
 * Sortierung: Häufigkeit absteigend, bei Gleichstand alphabetisch — ohne den zweiten Schlüssel
 * hinge die Reihenfolge gleich häufiger Wörter an der Eingabereihenfolge und wechselte
 * scheinbar zufällig zwischen zwei Aufrufen.
 */
export function wordFrequency(answers: readonly string[], limit = 24): WordCount[] {
  const counts = new Map<string, number>()

  for (const answer of answers) {
    const words = new Set(
      answer
        .toLowerCase()
        .split(/[^\p{Letter}\p{Number}]+/u)
        .filter((word) => word.length >= MIN_WORD_LENGTH),
    )
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'de'))
    .slice(0, limit)
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
