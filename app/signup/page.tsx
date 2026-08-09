import type { Metadata } from 'next'

import { BRAND } from '@/lib/brand'
import { SIGNUP_OPTIONS } from '@/lib/sectors'

import { signupAction } from './actions'

// Auswählbare Geschäftsarten = die AKTIVEN (sector, business_type)-Kombinationen aus der Registry
// (lib/sectors/index.ts). Aktuell „Hotel / Resort" und „Reiseagentur" (beide sector=tourism). Wird
// ein Sektor/eine business_type aktiviert, erscheint die Option hier automatisch. Das technische
// Wort „Branche"/„Sektor" wird dem Kunden bewusst NICHT gezeigt.
const BUSINESS_OPTIONS = SIGNUP_OPTIONS

export const metadata: Metadata = { title: `Konto erstellen – ${BRAND.name}` }

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'Bitte überprüfe deine Eingaben.',
  rate_limited: 'Zu viele Registrierungen. Bitte warte eine Stunde.',
  server: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
}

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function SignupPage({ searchParams }: Props) {
  const { error } = await searchParams
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Ein Fehler ist aufgetreten.') : null

  // Adaptiv (0015-Muster erweitert): bei genau einer Geschäftsart schreibgeschützt anzeigen
  // (+ hidden input); bei mehreren echte Auswahl. Der Wert reist als `signupChoice` zum Trigger,
  // der die Server-Action serverseitig in sector + business_type auflöst.
  const defaultOption = BUSINESS_OPTIONS[0]

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.heading}>{BRAND.name}</h1>
        <p style={styles.subtitle}>{BRAND.slogan}</p>

        {errorMessage && (
          <p role="alert" style={styles.error}>
            {errorMessage}
          </p>
        )}

        <form action={signupAction} style={styles.form}>
          <label style={styles.label}>
            Name deines Unternehmens
            <input
              type="text"
              name="brandName"
              required
              maxLength={100}
              placeholder="z. B. Sunrise Tours"
              style={styles.input}
            />
            <span style={styles.hint}>Dieser Name wird deinen Gästen angezeigt.</span>
          </label>

          {defaultOption &&
            (BUSINESS_OPTIONS.length > 1 ? (
              <label style={styles.label}>
                Was beschreibt dein Unternehmen?
                <select
                  name="signupChoice"
                  required
                  defaultValue={defaultOption.value}
                  style={styles.input}
                >
                  {BUSINESS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span style={styles.hint}>
                  Diese Wahl bestimmt deine Kampagnentypen und kann später nicht geändert werden.
                </span>
              </label>
            ) : (
              <label style={styles.label}>
                Was beschreibt dein Unternehmen?
                <input
                  type="text"
                  value={defaultOption.label}
                  readOnly
                  style={styles.inputReadonly}
                />
                <input type="hidden" name="signupChoice" value={defaultOption.value} />
                <span style={styles.hint}>
                  Aktuell verfügbar: {defaultOption.label}. Diese Wahl kann später nicht geändert
                  werden.
                </span>
              </label>
            ))}

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
              autoComplete="new-password"
              minLength={8}
              style={styles.input}
            />
          </label>

          <button type="submit" style={styles.button}>
            Konto erstellen
          </button>
        </form>

        <a href="/login" style={styles.link}>
          Schon ein Konto? Anmelden
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
  hint: {
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: 400,
  } as React.CSSProperties,
  input: {
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    padding: '0.5rem 0.75rem',
    outline: 'none',
  } as React.CSSProperties,
  inputReadonly: {
    background: '#f9fafb',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#6b7280',
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
