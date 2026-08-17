import { describe, expect, it } from 'vitest'

import { resolveOrigin } from '@/lib/app-url'

const FALLBACK = 'https://guestmatrix.example'

function headers(over: Partial<Parameters<typeof resolveOrigin>[0]> = {}) {
  return { host: null, forwardedHost: null, forwardedProto: null, ...over }
}

describe('resolveOrigin', () => {
  // Der Fall, der den QR-Code am Telefon unbrauchbar machte: das Dashboard läuft über die LAN-IP,
  // der Link zeigte auf `localhost` — und `localhost` ist auf dem Telefon das Telefon.
  it('uses the address the operator is actually on', () => {
    expect(resolveOrigin(headers({ host: '192.168.43.250:3000' }), FALLBACK)).toBe(
      'http://192.168.43.250:3000',
    )
  })

  it('assumes http only for local and private networks', () => {
    for (const host of [
      'localhost:3000',
      '127.0.0.1:3000',
      '10.0.0.8',
      '172.16.4.2',
      'nas.local',
    ]) {
      expect(resolveOrigin(headers({ host }), FALLBACK)).toBe(`http://${host}`)
    }
    // 172.32 liegt AUSSERHALB von 172.16.0.0/12 — eine öffentliche Adresse.
    expect(resolveOrigin(headers({ host: '172.32.0.1' }), FALLBACK)).toBe('https://172.32.0.1')
    expect(resolveOrigin(headers({ host: 'kunde.example.com' }), FALLBACK)).toBe(
      'https://kunde.example.com',
    )
  })

  // Hinter einem Proxy (Vercel) trägt `host` den internen Namen; die Wahrheit steht in den
  // x-forwarded-*-Kopfzeilen.
  it('prefers the forwarded host and protocol behind a proxy', () => {
    const origin = resolveOrigin(
      headers({
        host: 'intern-abc.vercel.internal',
        forwardedHost: 'app.kunde.de',
        forwardedProto: 'https',
      }),
      FALLBACK,
    )
    expect(origin).toBe('https://app.kunde.de')
  })

  it('takes the first entry of a chained proxy header', () => {
    const origin = resolveOrigin(
      headers({ forwardedHost: 'app.kunde.de, intern', forwardedProto: 'https, http' }),
      FALLBACK,
    )
    expect(origin).toBe('https://app.kunde.de')
  })

  // Ein explizites Protokoll schlägt die Vermutung — ein lokaler Reverse-Proxy kann sehr wohl TLS
  // sprechen.
  it('trusts an explicit protocol even for a private address', () => {
    expect(resolveOrigin(headers({ host: '192.168.1.5', forwardedProto: 'https' }), FALLBACK)).toBe(
      'https://192.168.1.5',
    )
  })

  it('falls back to the configured address when the request carries no host', () => {
    expect(resolveOrigin(headers(), FALLBACK)).toBe(FALLBACK)
    expect(resolveOrigin(headers({ host: '', forwardedHost: '  ' }), FALLBACK)).toBe(FALLBACK)
  })
})
