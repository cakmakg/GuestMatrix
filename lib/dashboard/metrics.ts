/**
 * Kennzahlen-Mathematik für das Dashboard.
 *
 * Bewusst rein (keine DB, kein Next-Runtime): die Seite liefert Zeitstempel, diese
 * Funktionen erzeugen daraus Sparkline-Pfade und Veränderungswerte. Damit ist die
 * Rechenlogik ohne Supabase testbar.
 *
 * Der Entwurf („Guestly Dashboard.dc.html") zeigt fertige SVG-Pfade auf einer
 * viewBox von 0 0 100 32 — dieses Koordinatensystem wird hier beibehalten.
 */

export const SPARK_WIDTH = 100
export const SPARK_HEIGHT = 32

/** Vertikaler Rand, damit Extremwerte nicht an der Kante des Feldes kleben. */
const SPARK_PADDING = 4

export type SparkPath = {
  /** `d` der Linie. */
  line: string
  /** `d` der Fläche darunter (Linie, zur Grundlinie geschlossen). */
  fill: string
}

/** Auf zwei Nachkommastellen kürzen, ohne nachlaufende Nullen. */
function trim(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/**
 * Wandelt eine Zahlenreihe in SVG-Pfade um. Bei weniger als zwei Punkten gibt es
 * nichts zu zeichnen — dann bleiben beide Pfade leer (die Seite rendert das SVG dann nicht).
 */
export function sparklinePath(series: readonly number[]): SparkPath {
  if (series.length < 2) return { line: '', fill: '' }

  const max = Math.max(...series)
  const min = Math.min(...series)
  // Eine flache Reihe (max === min) würde durch 0 teilen; sie wird mittig gezeichnet.
  const span = max - min
  const usable = SPARK_HEIGHT - SPARK_PADDING * 2

  const points = series.map((value, index) => {
    const x = (index / (series.length - 1)) * SPARK_WIDTH
    const ratio = span === 0 ? 0.5 : (value - min) / span
    const y = SPARK_PADDING + (1 - ratio) * usable
    return `${trim(x)},${trim(y)}`
  })

  const line = `M${points.join(' L')}`
  return {
    line,
    fill: `${line} L${SPARK_WIDTH},${SPARK_HEIGHT} L0,${SPARK_HEIGHT} Z`,
  }
}

/**
 * Zählt Zeitstempel (ms) in `buckets` gleich große Eimer über das Fenster
 * `[now - buckets * bucketMs, now]`. Werte außerhalb des Fensters werden ignoriert;
 * genau `now` fällt in den letzten Eimer.
 */
export function bucketCounts(
  timestamps: readonly number[],
  now: number,
  buckets: number,
  bucketMs: number,
): number[] {
  const out = new Array<number>(buckets).fill(0)
  if (buckets <= 0 || bucketMs <= 0) return out

  const start = now - buckets * bucketMs

  for (const timestamp of timestamps) {
    if (timestamp < start || timestamp > now) continue
    const index = Math.min(buckets - 1, Math.floor((timestamp - start) / bucketMs))
    out[index] = (out[index] ?? 0) + 1
  }

  return out
}

/**
 * Prozentuale Veränderung. `null` bedeutet „keine Vergleichsbasis" (Vormonat = 0 bei
 * gleichzeitig vorhandenem aktuellem Wert) — das ist keine unendliche Steigerung,
 * sondern schlicht neu.
 */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export type DeltaTone = 'up' | 'down' | 'flat' | 'new'

export function deltaTone(pct: number | null): DeltaTone {
  if (pct === null) return 'new'
  if (pct > 0) return 'up'
  if (pct < 0) return 'down'
  return 'flat'
}

/**
 * Ist diese Veränderung eine Verbesserung? `null` heißt „weder noch" (unverändert oder ohne
 * Vergleichsbasis). `higherIsBetter: false` kehrt die Bedeutung um — bei offenen Punkten ist
 * ein Rückgang der Erfolg. Ohne diese Unterscheidung läse ein wachsender Stapel kritischer
 * Rückmeldungen genauso positiv wie eine steigende Zufriedenheit.
 */
export function isImprovement(tone: DeltaTone, higherIsBetter = true): boolean | null {
  if (tone === 'flat' || tone === 'new') return null
  return (tone === 'up') === higherIsBetter
}

/** Deutsche Schreibweise: Dezimalkomma, echtes Minuszeichen (U+2212), schmales Leerzeichen vor %. */
export function formatPercentDelta(pct: number | null): string {
  if (pct === null) return 'Neu'
  if (pct === 0) return '±0,0 %'
  const sign = pct > 0 ? '+' : '−'
  return `${sign}${Math.abs(pct).toFixed(1).replace('.', ',')} %`
}

/** Ganzzahlen mit deutschem Tausenderpunkt (1.247), Dezimalstellen mit Komma (4,7). */
export function formatNumber(value: number, decimals = 0): string {
  const fixed = value.toFixed(decimals)
  const [int = '', dec] = fixed.split('.')
  const withSeparator = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec ? `${withSeparator},${dec}` : withSeparator
}

/**
 * Deutsche Relativzeit für Listen („vor 3 Std."). Ab 30 Tagen wird auf das absolute Datum
 * umgeschaltet — „vor 94 Tagen" sagt weniger als ein Datum. `null` (nie hochgeladen) bleibt leer.
 */
export function formatRelative(iso: string | null, now: number): string {
  if (iso === null) return ''

  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const diff = now - then
  if (diff < 60_000) return 'gerade eben'

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `vor ${minutes} Min.`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'gestern'
  if (days < 30) return `vor ${days} Tagen`

  return new Date(iso).toLocaleDateString('de-DE')
}

/** Anteil in Prozent, auf [0, 100] begrenzt — für Fortschrittsbalken. */
export function quotaPercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.max(0, Math.min(100, (used / limit) * 100))
}
