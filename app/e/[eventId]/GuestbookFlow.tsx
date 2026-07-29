'use client'

import { useCallback, useRef, useState } from 'react'

import type { GuestFlowLabels } from '@/lib/sectors'

import GuestShell from './GuestShell'

type Step = 'landing' | 'form' | 'submitting' | 'success'

type Props = {
  eventId: string
  eventName: string
  brandName: string | null
  description: string | null
  labels: GuestFlowLabels
}

const MAX_FILES = 10

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed: ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}

export default function GuestbookFlow({
  eventId,
  eventName,
  brandName,
  description,
  labels,
}: Props) {
  const [step, setStep] = useState<Step>('landing')
  const [consentChecked, setConsentChecked] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState(0)
  const [fileIndex, setFileIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submissionIds, setSubmissionIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const namePrompt = labels.namePrompt ?? 'Euer Name'
  const namePlaceholder = labels.namePlaceholder ?? 'Von wem ist der Gruß?'

  const handleConsentContinue = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (!res.ok) throw new Error('Session creation failed')
      setStep('form')
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : []
    setFiles(picked.slice(0, MAX_FILES))
    setError(null)
  }, [])

  const uploadOne = useCallback(
    async (file: File, trimmedName: string, trimmedMessage: string): Promise<string> => {
      const presignRes = await fetch('/api/submissions/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          fileName: file.name,
          mimeType: file.type,
          consent: true,
          guestName: trimmedName,
          message: trimmedMessage !== '' ? trimmedMessage : undefined,
        }),
      })
      if (!presignRes.ok) {
        const body = (await presignRes.json()) as { error?: string }
        throw new Error(body.error ?? 'Presign failed')
      }
      const { presignedUrl, submissionId } = (await presignRes.json()) as {
        presignedUrl: string
        submissionId: string
      }
      await uploadWithProgress(presignedUrl, file, setProgress)
      const confirmRes = await fetch(`/api/submissions/${submissionId}/confirm`, {
        method: 'PATCH',
      })
      if (!confirmRes.ok) throw new Error('Confirm failed')
      return submissionId
    },
    [eventId],
  )

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim()
    const trimmedMessage = message.trim()

    if (trimmedName === '') {
      setError('Bitte gebt euren Namen ein.')
      return
    }
    if (trimmedMessage === '' && files.length === 0) {
      setError('Bitte hinterlasst einen Glückwunsch oder ein Foto/Video.')
      return
    }

    setError(null)
    setStep('submitting')
    setProgress(0)
    setFileIndex(0)

    try {
      const ids: string[] = []

      // Beiträge mit Medien: pro Datei ein Submission-Datensatz (Name + Gruß je Datei).
      for (const [i, file] of files.entries()) {
        setFileIndex(i)
        setProgress(0)
        ids.push(await uploadOne(file, trimmedName, trimmedMessage))
      }

      // Reiner Glückwunsch ohne Medien: separater medienloser Beitrag.
      if (files.length === 0 && trimmedMessage !== '') {
        const res = await fetch(`/api/events/${eventId}/guestbook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestName: trimmedName, message: trimmedMessage, consent: true }),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error ?? 'Senden fehlgeschlagen.')
        }
        const body = (await res.json()) as { submissionId?: string }
        if (body.submissionId) ids.push(body.submissionId)
      }

      setSubmissionIds(ids)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen.')
      setStep('form')
    }
  }, [name, message, files, eventId, uploadOne])

  const handleDelete = useCallback(async () => {
    if (submissionIds.length === 0) return
    if (!confirm('Möchtet ihr euren Beitrag wirklich löschen?')) return
    try {
      await Promise.all(
        submissionIds.map((id) => fetch(`/api/submissions/${id}`, { method: 'DELETE' })),
      )
      setSubmissionIds([])
      alert('Euer Beitrag wurde gelöscht.')
    } catch {
      alert('Löschen fehlgeschlagen. Bitte versucht es erneut.')
    }
  }, [submissionIds])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <GuestShell brandName={brandName} eventName={eventName}>
      {/* ── Landing ──────────────────────────────────────────────────────── */}
      {step === 'landing' && (
        <div className="space-y-4">
          {description && <p className="text-gray-600 text-sm">{description}</p>}
          <p className="text-gray-700">{labels.landingHeadline}</p>

          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-indigo-600"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span className="text-sm text-gray-600">{labels.consentText}</span>
            </label>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleConsentContinue}
            disabled={!consentChecked}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium
                       disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700
                       transition-colors"
          >
            Weiter
          </button>
        </div>
      )}

      {/* ── Form (Name + Glückwunsch + Medien) ───────────────────────────── */}
      {step === 'form' && (
        <div className="space-y-5">
          <div>
            <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              {namePrompt}
            </label>
            <input
              id="guest-name"
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1.5">
              {labels.commentPrompt}
            </label>
            <textarea
              id="message"
              rows={4}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={labels.commentPlaceholder}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         resize-none"
            />
          </div>

          <div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center
                         cursor-pointer hover:border-indigo-400 transition-colors"
            >
              {files.length > 0 ? (
                <p className="text-sm text-gray-700">
                  {files.length === 1 ? files[0]?.name : `${files.length} Dateien ausgewählt`}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Fotos/Videos hinzufügen (optional)</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,video/mp4,video/quicktime"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              JPEG, PNG, MP4 oder MOV · max. {MAX_FILES} Dateien · je max. 50 MB
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium
                       hover:bg-indigo-700 transition-colors"
          >
            Absenden
          </button>
        </div>
      )}

      {/* ── Submitting ───────────────────────────────────────────────────── */}
      {step === 'submitting' && (
        <div className="space-y-4 py-4">
          <p className="text-gray-700 font-medium text-center">Wird gesendet…</p>
          {files.length > 0 && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500">
                {files.length > 1 ? `Datei ${fileIndex + 1} von ${files.length} · ` : ''}
                {progress}%
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">💐</div>
          <p className="text-gray-800 font-semibold text-lg">{labels.successText}</p>
          <p className="text-gray-500 text-sm">Das Brautpaar freut sich über euren Beitrag.</p>

          {submissionIds.length > 0 && (
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-600 underline mt-2"
            >
              Beitrag löschen (DSGVO)
            </button>
          )}
        </div>
      )}
    </GuestShell>
  )
}
