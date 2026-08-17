import type { ReactNode } from 'react'

type Props = {
  brandName: string | null
  eventName: string
  children: ReactNode
}

/**
 * Gemeinsame Karte mit Marken-/Event-Kopf für alle Gäste-Flows.
 *
 * Der farbige Kopfbalken ist weg. Er war das erste, was ein Gast nach dem Scannen sah — eine
 * Signalfläche über dem Namen der Feier. Jetzt trägt der Name selbst den Auftritt (Anzeigeschrift),
 * die Marke steht als leise Zeile darüber: der Gast soll wissen, wessen Seite das ist, hat aber
 * nicht danach gesucht.
 *
 * Der Seitenrahmen (Grund, Zentrierung, Thema, Anzeigeschrift) liegt in `page.tsx` — ein Server-
 * Component. Nur so kann das Thema aus der Registry kommen, ohne dass jeder Flow es weiterreicht.
 */
export default function GuestShell({ brandName, eventName, children }: Props) {
  return (
    <div className="gs-guest-card">
      <header className="gs-guest-head">
        {brandName && <p className="gs-guest-brand">{brandName}</p>}
        <h1 className="gs-guest-title">{eventName}</h1>
      </header>
      {children}
    </div>
  )
}
