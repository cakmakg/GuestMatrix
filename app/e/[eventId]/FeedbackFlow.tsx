'use client'

import { useCallback, useRef, useState } from 'react'

import type { GuestFlowLabels } from '@/lib/sectors'

import GuestShell from './GuestShell'

type Step = 'landing' | 'feedback' | 'submitting' | 'success'

type Props = {
  eventId: string
  eventName: string
  brandName: string | null
  description: string | null
  labels: GuestFlowLabels
}

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

export default function FeedbackFlow({
  eventId,
  eventName,
  brandName,
  description,
  labels,
}: Props) {
  // labels kommt als JSON über /api/events/[eventId]/public (fetch-gecacht). Defensiv gegen ein
  // Payload ohne questions (z. B. veralteter Cache) — der Gäste-Flow darf nie deshalb crashen.
  const questions = labels.questions ?? []
  const [step, setStep] = useState<Step>('landing')
  const [consentChecked, setConsentChecked] = useState(false)
  const [rating, setRating] = useState<number>(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConsentContinue = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (!res.ok) throw new Error('Session creation failed')
      setStep('feedback')
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null)
  }, [])

  const uploadMedia = useCallback(
    async (file: File): Promise<string> => {
      const presignRes = await fetch('/api/submissions/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, fileName: file.name, mimeType: file.type, consent: true }),
      })
      if (!presignRes.ok) {
        const body = (await presignRes.json()) as { error?: string }
        throw new Error(body.error ?? 'Presign failed')
      }
      const { presignedUrl, submissionId: sid } = (await presignRes.json()) as {
        presignedUrl: string
        submissionId: string
      }
      await uploadWithProgress(presignedUrl, file, setProgress)
      const confirmRes = await fetch(`/api/submissions/${sid}/confirm`, { method: 'PATCH' })
      if (!confirmRes.ok) throw new Error('Confirm failed')
      return sid
    },
    [eventId],
  )

  const handleSubmit = useCallback(async () => {
    const trimmed = comment.trim()
    const hasAnswers = Object.keys(answers).length > 0
    if (rating === 0 && trimmed === '' && !selectedFile && !hasAnswers) {
      setError('Bitte gib eine Bewertung oder einen Kommentar ab.')
      return
    }
    setError(null)
    setStep('submitting')
    setProgress(0)

    try {
      let sid: string | undefined
      if (selectedFile) {
        sid = await uploadMedia(selectedFile)
      }

      const res = await fetch(`/api/events/${eventId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating > 0 ? rating : undefined,
          comment: trimmed !== '' ? trimmed : undefined,
          answers: hasAnswers ? answers : undefined,
          submissionId: sid,
        }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Feedback fehlgeschlagen.')
      }
      const body = (await res.json()) as { submissionId?: string }
      setSubmissionId(body.submissionId ?? sid ?? null)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback fehlgeschlagen.')
      setStep('feedback')
    }
  }, [comment, answers, rating, selectedFile, eventId, uploadMedia])

  const handleDelete = useCallback(async () => {
    if (!submissionId) return
    if (!confirm('Möchtest du dein Feedback wirklich löschen?')) return
    try {
      await fetch(`/api/submissions/${submissionId}`, { method: 'DELETE' })
      setSubmissionId(null)
      alert('Dein Feedback wurde gelöscht.')
    } catch {
      alert('Löschen fehlgeschlagen. Bitte versuche es erneut.')
    }
  }, [submissionId])

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

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      {step === 'feedback' && (
        <div className="space-y-5">
          <div className="space-y-2 text-center">
            <p className="text-gray-700 font-medium">{labels.ratingPrompt}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-4xl hover:scale-110 transition-transform"
                  aria-label={`${star} Sterne`}
                >
                  {star <= rating ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>

          {/* Strukturierte Zusatzfragen (aus dem Kampagnen-Katalog) — alle optional. */}
          {questions.length > 0 && (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600">{q.prompt}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: star }))}
                        className="text-2xl leading-none hover:scale-110 transition-transform"
                        aria-label={`${q.prompt}: ${star} Sterne`}
                      >
                        {star <= (answers[q.id] ?? 0) ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1.5">
              {labels.commentPrompt}
            </label>
            <textarea
              id="comment"
              rows={4}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
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
              {selectedFile ? (
                <p className="text-sm text-gray-700 truncate">{selectedFile.name}</p>
              ) : (
                <p className="text-sm text-gray-400">Foto/Video anhängen (optional)</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,video/mp4,video/quicktime"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">JPEG, PNG, MP4 oder MOV · Max. 50 MB</p>
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
          {selectedFile && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500">{progress}%</p>
            </>
          )}
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">🙏</div>
          <p className="text-gray-800 font-semibold text-lg">{labels.successText}</p>
          <p className="text-gray-500 text-sm">Dein Feedback wurde übermittelt.</p>

          {submissionId && (
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-600 underline mt-2"
            >
              Feedback löschen (DSGVO)
            </button>
          )}
        </div>
      )}
    </GuestShell>
  )
}
