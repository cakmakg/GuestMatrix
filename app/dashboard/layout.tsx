import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireTenantAuth()
  } catch {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="font-bold text-indigo-600 text-lg">GuestMatrix</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                       rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span>📊</span> Übersicht
          </Link>
          <Link
            href="/dashboard/events/new"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                       rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span>➕</span> Kampagne erstellen
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                       rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span>⚙️</span> Einstellungen
          </Link>
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500
                         rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <span>🚪</span> Abmelden
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
