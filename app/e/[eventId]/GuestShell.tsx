import type { ReactNode } from 'react'

type Props = {
  brandName: string | null
  eventName: string
  children: ReactNode
}

/** Gemeinsame Karten-Hülle mit Marken-/Event-Header für alle Gäste-Flows. */
export default function GuestShell({ brandName, eventName, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-indigo-600 px-6 py-5 text-white">
          {brandName && <p className="text-indigo-200 text-sm mb-1">{brandName}</p>}
          <h1 className="text-xl font-bold">{eventName}</h1>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
