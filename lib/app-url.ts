import 'server-only'

import { headers } from 'next/headers'

/**
 * Unter welcher Adresse der Betreiber das Dashboard GERADE benutzt — die Grundlage jedes
 * Gästelinks und jedes QR-Codes.
 *
 * Vorher stand dort `NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`, also ein Wert aus der
 * Umgebung statt aus der Wirklichkeit. Das ging schief, sobald beide auseinanderliefen:
 *
 * - Am Telefon im WLAN (`http://192.168.x.x:3000`) zeigte der QR auf `localhost` — und `localhost`
 *   ist auf dem Telefon das TELEFON. Der Code war unbenutzbar, der kopierte Link öffnete nichts.
 * - Dasselbe bei Vorschau-Deployments und eigenen Domains: der Betreiber sieht Domain A, der Gast
 *   bekommt Domain B.
 *
 * Der QR-Code IST das Produkt; er darf nicht davon abhängen, ob eine Variable gepflegt wurde.
 *
 * ── Wofür das ausdrücklich NICHT gilt ──────────────────────────────────────────
 * Für Links, die wir VERSENDEN (Bestätigungs- und Passwort-Mails, `app/signup/actions.ts`,
 * `app/forgot-password/actions.ts`), bleibt `NEXT_PUBLIC_APP_URL` die Quelle. Der Host-Header
 * kommt vom Client; wer ihn fälscht, bekäme hier nur seinen eigenen Bildschirm verbogen — in
 * einer Mail wäre es ein Link in fremde Hände (Host-Header-Injection).
 */

export type OriginHeaders = {
  host: string | null
  forwardedHost: string | null
  forwardedProto: string | null
}

/** Private/lokale Netze sprechen im Betrieb kein TLS — dort ist `http` die richtige Annahme. */
function isLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true
  if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) return true
  // 10.0.0.0/8 · 192.168.0.0/16 · 172.16.0.0/12
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
}

/** Erster Wert einer möglicherweise verketteten Proxy-Kopfzeile („a, b" → „a"). */
function firstValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim()
  return first === undefined || first === '' ? null : first
}

/**
 * Rein, damit die Regeln ohne Request testbar sind (`tests/app-url.test.ts`).
 *
 * `x-forwarded-host` schlägt `host`: hinter einem Proxy (Vercel) trägt `host` den internen Namen.
 * Fehlt jede Angabe, bleibt der konfigurierte Wert — besser eine gepflegte Adresse als gar keine.
 */
export function resolveOrigin(input: OriginHeaders, fallback: string): string {
  const host = firstValue(input.forwardedHost) ?? firstValue(input.host)
  if (host === null) return fallback

  // Der Port gehört zum Host, aber nicht zur Frage, ob das Netz lokal ist.
  const hostname = host.replace(/:\d+$/, '')
  const proto = firstValue(input.forwardedProto) ?? (isLocalHost(hostname) ? 'http' : 'https')

  return `${proto}://${host}`
}

/** Der konfigurierte Rückfall — nur, wenn der Request keinen Host mitbringt. */
export function configuredOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function appOrigin(): Promise<string> {
  const requestHeaders = await headers()

  return resolveOrigin(
    {
      host: requestHeaders.get('host'),
      forwardedHost: requestHeaders.get('x-forwarded-host'),
      forwardedProto: requestHeaders.get('x-forwarded-proto'),
    },
    configuredOrigin(),
  )
}

/** Die Adresse hinter dem QR-Code einer Kampagne. */
export async function guestUrlFor(eventId: string): Promise<string> {
  return `${await appOrigin()}/e/${eventId}`
}
