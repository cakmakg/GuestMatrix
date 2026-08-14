import {
  CAMPAIGN_TYPES,
  allowedCampaignTypes,
  getCampaignConfig,
  isBusinessType,
  isSector,
} from '@/lib/sectors'

import { createEventAction } from './actions'

/**
 * Das Anlegen-Formular — EINE Quelle für beide Stellen, an denen es erscheint:
 * die eigene Seite (`/dashboard/events/new`) und die leere Übersicht.
 *
 * Als Kopie hätten die beiden Fassungen sofort auseinanderzulaufen begonnen: jedes neue Feld
 * (zuletzt „Ort") müsste man an zwei Stellen nachtragen, und die eine, die man vergisst, verliert
 * die Eingabe still — das Formular sendet dann einfach ein Feld weniger.
 *
 * `returnTo` sagt der Server Action, wohin sie nach Fehler bzw. Erfolg zurückkehrt; die Action
 * prüft den Wert gegen eine Allowlist (kein offener Redirect).
 */

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

/** Auswahlkarte für eine Optionsgruppe (Kampagnentyp / Ablauf / Sichtbarkeit). */
function OptionCard({
  name,
  value,
  title,
  hint,
  defaultChecked,
  required,
}: {
  name: string
  value: string
  title: string
  hint?: string
  defaultChecked?: boolean
  required?: boolean
}): React.ReactElement {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        border: '1px solid var(--color-divider)',
        padding: '12px 14px',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--color-accent)' }}
      />
      <span style={{ fontSize: 14 }}>
        {title}
        {hint && (
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{hint}</span>
        )}
      </span>
    </label>
  )
}

type Props = {
  sector: string
  businessType: string | null
  /** Wohin die Action zurückkehrt. Muss in der Allowlist der Action stehen. */
  returnTo: string
  submitLabel: string
  /** Positionsindex für die gestaffelte Einblendung (`gs-rise`). */
  riseIndex?: string
}

export function EventForm({
  sector,
  businessType,
  returnTo,
  submitLabel,
  riseIndex = '2',
}: Props): React.ReactElement {
  const today = new Date().toISOString().split('T')[0]

  // Kampagnentypen nach der business_type-Unterrolle filtern (Hotel→stay, Agentur→agency). Reine
  // UX-Einschränkung — die harte Grenze erzwingt die RLS-WITH-CHECK (0017) beim INSERT.
  const resolvedSector = isSector(sector) ? sector : null
  const resolvedBusinessType = businessType && isBusinessType(businessType) ? businessType : null
  const types = resolvedSector ? allowedCampaignTypes(resolvedSector, resolvedBusinessType) : []
  const singleType = types.length === 1 ? types[0] : null
  // Flow-Modus-Wahl nur, wenn der (einzige) Typ sie erlaubt (aktuell: Immobilie).
  const flowChoiceType =
    singleType && getCampaignConfig(singleType)?.allowFlowModeChoice ? singleType : null
  // Sichtbarkeits-Wahl nur, wenn der (einzige) Typ sie erlaubt (aktuell: Hochzeit, 0021).
  const visibilityChoiceType =
    singleType && getCampaignConfig(singleType)?.allowVisibilityChoice ? singleType : null

  return (
    <form
      action={createEventAction}
      className="gs-panel gs-rise"
      data-i={riseIndex}
      style={{ gap: 20 }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />

      {/* Kampagnentyp */}
      {singleType ? (
        <input type="hidden" name="campaignType" value={singleType} />
      ) : (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
            Kampagnentyp <span style={{ color: 'var(--color-accent)' }}>*</span>
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {types.map((type, index) => (
              <OptionCard
                key={type}
                name="campaignType"
                value={type}
                title={CAMPAIGN_TYPES[type]?.label ?? type}
                defaultChecked={index === 0}
                required
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Ablauf (nur bei Typen mit Wahlmöglichkeit) */}
      {flowChoiceType && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Ablauf</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <OptionCard
              name="flowMode"
              value="feedback"
              title="Feedback"
              hint="Bewertung & Kommentar, privat an dich"
              defaultChecked
            />
            <OptionCard
              name="flowMode"
              value="gallery"
              title="Galerie"
              hint="Gäste teilen Fotos/Videos in einer Galerie"
            />
          </div>
        </fieldset>
      )}

      {/* Sichtbarkeit (nur bei Typen mit Wahlmöglichkeit, z. B. Hochzeit) */}
      {visibilityChoiceType && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Sichtbarkeit</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <OptionCard
              name="visibility"
              value="private"
              title="Privat"
              hint="Nur ihr seht die Grüße eurer Gäste"
              defaultChecked
            />
            <OptionCard
              name="visibility"
              value="shared"
              title="Geteilt"
              hint="Alle Gäste der Feier sehen die Grüße mit"
            />
            <OptionCard
              name="visibility"
              value="moderated"
              title="Moderiert"
              hint="Wie geteilt, nach Prüfung durch euch"
            />
          </div>
          <p style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
            Kann nach dem Anlegen nicht mehr geändert werden — der Einwilligungstext für eure Gäste
            hängt daran.
          </p>
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="name">
          Name <span style={{ color: 'var(--color-accent)' }}>*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          className="input"
          placeholder="z. B. Sommerfest · Juni 2026"
        />
      </div>

      <div className="field">
        <label htmlFor="date">
          Datum <span style={{ color: 'var(--color-accent)' }}>*</span>
        </label>
        <input id="date" name="date" type="date" required defaultValue={today} className="input" />
      </div>

      <div className="field">
        <label htmlFor="venue">Ort</label>
        <input
          id="venue"
          name="venue"
          type="text"
          maxLength={120}
          className="input"
          placeholder="z. B. Villa Sole, Izmir (optional)"
        />
      </div>

      <div className="field">
        <label htmlFor="description">Begrüßung für deine Gäste</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className="input"
          placeholder="Kurzer Text, den deine Gäste beim Scannen sehen (optional)"
        />
      </div>

      <button type="submit" className="btn btn-primary" style={{ minHeight: 44 }}>
        {submitLabel}
      </button>
    </form>
  )
}
