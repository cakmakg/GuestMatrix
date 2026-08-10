import type { Metadata } from 'next'

import { loginAction } from './actions'

export const metadata: Metadata = { title: 'Anmelden – GuestMatrix' }

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-Mail-Adresse oder Passwort ist falsch.',
  rate_limited: 'Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten.',
  idle_timeout: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
}

type Props = {
  searchParams: Promise<{ error?: string; next?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, next, message } = await searchParams
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Ein Fehler ist aufgetreten.') : null
  const SUCCESS_MESSAGES: Record<string, string> = {
    'password-reset-success': 'Passwort erfolgreich geändert. Bitte melden Sie sich an.',
    'signup-success':
      'Registrierung erfolgreich. Falls E-Mail-Bestätigung aktiv ist, bestätigen Sie bitte Ihre E-Mail und melden Sie sich anschließend an.',
    confirmed: 'E-Mail bestätigt. Bitte melden Sie sich an.',
  }
  const successMessage = message ? (SUCCESS_MESSAGES[message] ?? null) : null

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.heading}>GuestMatrix</h1>
        <p style={styles.subtitle}>Tenant-Anmeldung</p>

        {successMessage && (
          <p role="status" style={styles.success}>
            {successMessage}
          </p>
        )}
        {errorMessage && (
          <p role="alert" style={styles.error}>
            {errorMessage}
          </p>
        )}

        <form action={loginAction} style={styles.form}>
          <input type="hidden" name="next" value={next ?? '/dashboard'} />

          <label style={styles.label}>
            E-Mail-Adresse
            <input type="email" name="email" required autoComplete="email" style={styles.input} />
          </label>

          <label style={styles.label}>
            Passwort
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
              style={styles.input}
            />
          </label>

          <button type="submit" style={styles.button}>
            Anmelden
          </button>
        </form>

        <a href="/forgot-password" style={styles.link}>
          Passwort vergessen?
        </a>
        <a href="/signup" style={styles.link}>
          Noch kein Konto? Registrieren
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
    margin: '0 0 0.25rem',
    fontSize: '1.5rem',
    fontWeight: 700,
  } as React.CSSProperties,
  subtitle: {
    margin: '0 0 1.5rem',
    color: '#666',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#991b1b',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    padding: '0.75rem',
  } as React.CSSProperties,
  success: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    color: '#166534',
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
    outline: 'none',
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
