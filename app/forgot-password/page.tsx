import type { Metadata } from 'next'

import { forgotPasswordAction } from './actions'

export const metadata: Metadata = { title: 'Passwort vergessen – GuestMatrix' }

type Props = {
  searchParams: Promise<{ sent?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { sent } = await searchParams
  const submitted = sent === '1'

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Passwort zurücksetzen</h1>

        {submitted ? (
          <p role="status" style={styles.info}>
            Falls die E-Mail-Adresse registriert ist, wurde ein Reset-Link gesendet. Bitte prüfen
            Sie Ihren Posteingang.
          </p>
        ) : (
          <>
            <p style={styles.description}>
              Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link zum Zurücksetzen Ihres
              Passworts.
            </p>

            <form action={forgotPasswordAction} style={styles.form}>
              <label style={styles.label}>
                E-Mail-Adresse
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  style={styles.input}
                />
              </label>

              <button type="submit" style={styles.button}>
                Reset-Link senden
              </button>
            </form>
          </>
        )}

        <a href="/login" style={styles.link}>
          Zurück zur Anmeldung
        </a>
      </div>
    </main>
  )
}

const styles = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    padding: '1rem',
  } as React.CSSProperties,
  card: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0,0,0,.12)',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
  } as React.CSSProperties,
  heading: {
    margin: '0 0 1rem',
    fontSize: '1.5rem',
    fontWeight: 700,
  } as React.CSSProperties,
  description: {
    color: '#4b5563',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
  } as React.CSSProperties,
  info: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    color: '#1d4ed8',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    padding: '0.75rem',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  } as React.CSSProperties,
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.875rem',
    fontWeight: 500,
    gap: '0.375rem',
  } as React.CSSProperties,
  input: {
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    padding: '0.5rem 0.75rem',
  } as React.CSSProperties,
  button: {
    background: '#111827',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: 500,
    marginTop: '0.5rem',
    padding: '0.625rem',
  } as React.CSSProperties,
  link: {
    color: '#4b5563',
    display: 'block',
    fontSize: '0.875rem',
    marginTop: '1rem',
    textAlign: 'center',
    textDecoration: 'none',
  } as React.CSSProperties,
}
