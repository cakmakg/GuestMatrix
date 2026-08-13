import type { EventVisibility } from '@/lib/sectors'

import { updateEventAction } from '../../actions'

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

/**
 * Wie die gewählte Sichtbarkeit dem Betreiber erklärt wird. Bewusst aus SEINER Sicht formuliert
 * („wer sieht die Beiträge"), nicht aus der Gastsicht — der Gast liest den Einwilligungstext
 * (GUESTBOOK_VISIBILITY_CONSENT_TEXT), hier steht die Folge für den Veranstalter.
 */
const VISIBILITY_EXPLANATION: Record<EventVisibility, { label: string; hint: string }> = {
  private: {
    label: 'Privat',
    hint: 'Nur du siehst die Beiträge deiner Gäste.',
  },
  shared: {
    label: 'Geteilt',
    hint: 'Alle Gäste dieser Kampagne sehen die Beiträge mit.',
  },
  moderated: {
    label: 'Moderiert',
    hint: 'Gäste sehen die Beiträge mit, sobald du sie freigegeben hast.',
  },
}

type Props = {
  eventId: string
  name: string
  date: string
  venue: string | null
  description: string | null
  visibility: EventVisibility
  /** Nur Kampagnentypen mit Sichtbarkeitswahl zeigen die Zeile überhaupt an. */
  showVisibility: boolean
  saved: boolean
  error?: string
}

export function EventSettings({
  eventId,
  name,
  date,
  venue,
  description,
  visibility,
  showVisibility,
  saved,
  error,
}: Props): React.ReactElement {
  const explanation = VISIBILITY_EXPLANATION[visibility]

  return (
    <section className="gs-panel gs-rise" data-i="4" style={{ gap: 18 }}>
      <div>
        <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Einstellungen</h3>
        <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
          Name, Datum, Ort und die Begrüßung, die deine Gäste beim Scannen lesen.
        </p>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--color-accent)', margin: 0 }}>
          {decodeURIComponent(error)}
        </p>
      )}
      {saved && !error && <p style={{ fontSize: 13, margin: 0 }}>Gespeichert.</p>}

      <form
        action={updateEventAction.bind(null, eventId)}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div className="field">
          <label htmlFor="event-name">
            Name <span style={{ color: 'var(--color-accent)' }}>*</span>
          </label>
          <input
            id="event-name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={name}
            className="input"
          />
        </div>

        <div className="field">
          <label htmlFor="event-date">
            Datum <span style={{ color: 'var(--color-accent)' }}>*</span>
          </label>
          <input
            id="event-date"
            name="date"
            type="date"
            required
            defaultValue={date}
            className="input"
          />
        </div>

        <div className="field">
          <label htmlFor="event-venue">Ort</label>
          <input
            id="event-venue"
            name="venue"
            type="text"
            maxLength={120}
            defaultValue={venue ?? ''}
            className="input"
            placeholder="optional"
          />
        </div>

        <div className="field">
          <label htmlFor="event-description">Begrüßung für deine Gäste</label>
          <textarea
            id="event-description"
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={description ?? ''}
            className="input"
            placeholder="optional"
          />
        </div>

        {/* Sichtbarkeit: ANZEIGE, kein Feld. Sie wurde beim Anlegen gewählt und ist danach
            unveränderlich — der Einwilligungstext der bereits abgegebenen Beiträge hängt daran.
            Die DB lehnt eine Änderung ohnehin ab (0021); hier steht der Grund, statt eines
            Eingabefelds, das nur scheitern könnte. */}
        {showVisibility && (
          <div
            style={{
              border: '1px solid var(--color-divider)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              Sichtbarkeit
            </div>
            <div style={{ font: '600 14px/1.3 var(--font-body)' }}>{explanation.label}</div>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>{explanation.hint}</p>
            <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 0' }}>
              Beim Anlegen gewählt und nicht änderbar: deine Gäste haben genau dieser Sichtbarkeit
              zugestimmt.
            </p>
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ minHeight: 44 }}>
          Speichern
        </button>
      </form>
    </section>
  )
}
