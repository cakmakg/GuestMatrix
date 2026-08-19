import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'

import { BRAND } from '@/lib/brand'

import './globals.css'

// Selbst gehostet über next/font — ein @import von fonts.googleapis.com würde an der
// CSP scheitern (`style-src 'self'`, `font-src 'self'` in next.config.ts).
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-archivo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: BRAND.name,
  description:
    'Sammle Fotos, Videos und Feedback direkt von deinen Gästen — mit einem einzigen QR-Code.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={archivo.variable}>
      {/* suppressHydrationWarning: Browser-Erweiterungen (z. B. ColorZilla → cz-shortcut-listen)
          injizieren Attribute am <body>, was sonst eine Hydration-Warnung auslöst. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
