import Link from 'next/link'

import { createEventAction } from './actions'

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Zurück
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Neues Event erstellen</h1>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      <form
        action={createEventAction}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
            Event-Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="z. B. Hochzeit Schmidt · Juni 2026"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Datum <span className="text-red-500">*</span>
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={today}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
            Beschreibung
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            placeholder="Kurze Beschreibung für deine Gäste (optional)"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg
                     hover:bg-indigo-700 transition-colors"
        >
          Event erstellen
        </button>
      </form>
    </div>
  )
}
