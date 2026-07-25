import type { Metadata } from 'next'

import { resetPasswordAction } from './actions'

export const metadata: Metadata = { title: 'Neues Passwort – GuestMatrix' }

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: 'Dieser Reset-Link ist ungültig oder abgelaufen.',
  update_failed: 'Passwort konnte nicht geändert werden. Bitte fordern Sie einen neuen Link an.',
}

type Props = {
  searchParams: Promise<{ code?: string; error?: string; message?: string }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { code, error, message } = await searchParams

  const errorMessage =
    error === 'validation'
      ? (message ?? 'Ungültige Eingabe.')
      : error
        ? (ERROR_MESSAGES[error] ?? 'Ein Fehler ist aufgetreten.')
        : null

  if (!code) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Link ungültig</h1>
          <p style={styles.error}>{ERROR_MESSAGES.invalid_link}</p>
          <a href="/forgot-password" style={styles.link}>
            Neuen Reset-Link anfordern
          </a>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Neues Passwort setzen</h1>

        {errorMessage && (
          <p role="alert" style={styles.errorBox}>
            {errorMessage}
          </p>
        )}

        <form action={resetPasswordAction} style={styles.form}>
          <input type="hidden" name="code" value={code} />

          <label style={styles.label}>
            Neues Passwort
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={8}
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Passwort bestätigen
            <input
              type="password"
              name="confirmPassword"
              required
              autoComplete="new-password"
              minLength={8}
              style={styles.input}
            />
          </label>

          <button type="submit" style={styles.button}>
            Passwort ändern
          </button>
        </form>
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
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#991b1b',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    padding: '0.75rem',
  } as React.CSSProperties,
  error: {
    color: '#991b1b',
    fontSize: '0.875rem',
    marginBottom: '1rem',
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
    textDecoration: 'none',
  } as React.CSSProperties,
}
