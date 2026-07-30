import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError, StorageDeletionError } from '@/lib/auth/errors'
import { deleteSubmission } from '@/lib/submissions/delete-submission'

// Fail-safe-Invariante von deleteSubmission: die Datei wird ZUERST aus dem Storage entfernt und
// der Fehler geprüft; erst danach committet die DB `deleted_at`. Schlägt die Storage-Löschung
// fehl, darf `soft_delete_submission` NIE aufgerufen werden — sonst hätten wir eine als gelöscht
// markierte Zeile mit noch existierender Datei (stille DSGVO-Diskrepanz). Die Ownership-Prüfung
// selbst liegt in der DB (RPCs) und wird im SQL-Nachweis geführt; hier geht es um die Reihenfolge.

const { rpcMock, removeMock, fromMock } = vi.hoisted(() => {
  const removeMock = vi.fn()
  const fromMock = vi.fn(() => ({ remove: removeMock }))
  const rpcMock = vi.fn()
  return { rpcMock, removeMock, fromMock }
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc: rpcMock })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { storage: { from: fromMock } },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const SUBMISSION_ID = '00000000-0000-0000-0000-000000000001'
const MEDIA_URL = 'tenant-a/event-a/submission-a/x.jpg'

type RpcResult = { data: unknown; error: unknown }

// Konfiguriert die beiden RPCs (Lesen + Commit) nach Funktionsnamen — robust gegenüber der
// Aufrufreihenfolge, im Gegensatz zu einer mockResolvedValueOnce-Kette.
function stubRpc(overrides: { read?: RpcResult; commit?: RpcResult } = {}): void {
  rpcMock.mockImplementation((fn: string) => {
    if (fn === 'owned_submission_media') {
      return Promise.resolve(overrides.read ?? { data: [{ media_url: MEDIA_URL }], error: null })
    }
    if (fn === 'soft_delete_submission') {
      return Promise.resolve(overrides.commit ?? { data: SUBMISSION_ID, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })
}

function committed(): boolean {
  return rpcMock.mock.calls.some((call) => call[0] === 'soft_delete_submission')
}

beforeEach(() => {
  vi.clearAllMocks()
  removeMock.mockResolvedValue({ error: null })
})

describe('deleteSubmission — fail-safe Reihenfolge', () => {
  it('entfernt zuerst die Datei und committet danach den Soft-Delete', async () => {
    stubRpc()

    await expect(deleteSubmission(SUBMISSION_ID)).resolves.toBeUndefined()

    expect(fromMock).toHaveBeenCalledWith('ugc-media')
    expect(removeMock).toHaveBeenCalledWith([MEDIA_URL])
    expect(committed()).toBe(true)

    // Reihenfolge hart belegen: Storage-remove passiert vor dem DB-Commit.
    const removeOrder = removeMock.mock.invocationCallOrder[0]
    const commitIndex = rpcMock.mock.calls.findIndex((call) => call[0] === 'soft_delete_submission')
    const commitOrder = rpcMock.mock.invocationCallOrder[commitIndex]
    if (removeOrder === undefined || commitOrder === undefined) {
      throw new Error('erwartete Aufrufreihenfolge fehlt')
    }
    expect(removeOrder).toBeLessThan(commitOrder)
  })

  it('wirft StorageDeletionError und committet NICHT, wenn die Storage-Löschung fehlschlägt', async () => {
    stubRpc()
    removeMock.mockResolvedValue({ error: { message: 'network down' } })

    await expect(deleteSubmission(SUBMISSION_ID)).rejects.toBeInstanceOf(StorageDeletionError)

    expect(removeMock).toHaveBeenCalledWith([MEDIA_URL])
    expect(committed()).toBe(false)
  })

  it('wirft NotFoundError ohne Storage-Zugriff, wenn der Aufrufer die Einreichung nicht besitzt', async () => {
    stubRpc({ read: { data: [], error: null } })

    await expect(deleteSubmission(SUBMISSION_ID)).rejects.toBeInstanceOf(NotFoundError)

    expect(removeMock).not.toHaveBeenCalled()
    expect(committed()).toBe(false)
  })

  it('committet ohne Storage-Aufruf, wenn die Einreichung keine Datei hat (media_url null)', async () => {
    stubRpc({ read: { data: [{ media_url: null }], error: null } })

    await expect(deleteSubmission(SUBMISSION_ID)).resolves.toBeUndefined()

    expect(removeMock).not.toHaveBeenCalled()
    expect(committed()).toBe(true)
  })

  it('reicht einen Lesefehler durch und entfernt/committet nichts', async () => {
    const readError = new Error('rpc read failed')
    stubRpc({ read: { data: null, error: readError } })

    await expect(deleteSubmission(SUBMISSION_ID)).rejects.toBe(readError)

    expect(removeMock).not.toHaveBeenCalled()
    expect(committed()).toBe(false)
  })
})
