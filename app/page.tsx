import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>GuestMatrix</h1>
      <p>QR tabanlı guest UGC &amp; feedback platformu — Faz 0</p>
      <p style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <Link href="/login">Anmelden</Link>
        <Link href="/signup">Konto erstellen</Link>
      </p>
    </main>
  )
}
