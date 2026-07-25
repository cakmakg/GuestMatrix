import type { NextConfig } from 'next'

const SUPABASE_HOSTNAME = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : '*.supabase.co'

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' ist für Next.js 15 (Hydration-Inline-Skripte) erforderlich.
  // In Phase 2 durch CSP-Nonce-Infrastruktur ersetzen.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${SUPABASE_HOSTNAME}`,
  "font-src 'self'",
  `connect-src 'self' https://${SUPABASE_HOSTNAME} wss://${SUPABASE_HOSTNAME}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
]
  .join('; ')
  .trim()

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  // Verhindert Clickjacking-Angriffe
  { key: 'X-Frame-Options', value: 'DENY' },
  // Verhindert MIME-Sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Beschränkt Referrer-Informationen bei Cross-Origin-Anfragen
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Erzwingt HTTPS für 2 Jahre; inkl. Subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Deaktiviert nicht benötigte Browser-APIs
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Verhindert Cross-Origin-Informationslecks
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  // Maximale Upload-Größe: 100 MB (Videos)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
