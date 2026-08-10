import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GuestMatrix',
  description: 'QR tabanlı guest UGC & feedback platformu',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      {/* suppressHydrationWarning: Browser-Erweiterungen (z. B. ColorZilla → cz-shortcut-listen)
          injizieren Attribute am <body>, was sonst eine Hydration-Warnung auslöst. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
