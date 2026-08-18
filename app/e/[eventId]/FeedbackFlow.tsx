'use client'

import { useCallback, useState } from 'react'

import type { GuestFlowLabels } from '@/lib/sectors'

import { GuestPick } from './GuestPick'
import GuestShell from './GuestShell'
import { GuestStars } from './GuestStars'

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
  // Nach `rating` gefiltert wie im GalleryFlow: eine Freitextfrage bekäme hier sonst Sterne und
  // schickte eine Zahl an ein Textfeld, was validate_feedback_answers (DB) ablehnt.
  const questions = (labels.questions ?? []).filter((q) => q.type === 'rating')
  const namePrompt = labels.namePrompt ?? 'Dein Name'
  const namePlaceholder = labels.namePlaceholder ?? 'Vor- und Nachname'
  const [step, setStep] = useState<Step>('landing')
  const [consentChecked, setConsentChecked] = useState(false)
  // Freiwillig: ohne Namen bleibt die Rückmeldung anonym (siehe guestNameEnabled in lib/sectors).
  const [name, setName] = useState('')
  const [rating, setRating] = useState<number>(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)

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
    async (file: File, trimmedName: string): Promise<string> => {
      const presignRes = await fetch('/api/submissions/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          fileName: file.name,
          mimeType: file.type,
          consent: true,
          // Mit Medien entsteht die Zeile hier; der /feedback-Aufruf danach hängt sich nur an sie
          // und kann guest_name nicht mehr setzen (attach_feedback schreibt ihn nicht).
          guestName: trimmedName !== '' ? trimmedName : undefined,
        }),
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
    const trimmedName = name.trim()
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
        sid = await uploadMedia(selectedFile, trimmedName)
      }

      const res = await fetch(`/api/events/${eventId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating > 0 ? rating : undefined,
          comment: trimmed !== '' ? trimmed : undefined,
          answers: hasAnswers ? answers : undefined,
          submissionId: sid,
          // Wirkt nur im medienlosen Pfad (dort entsteht die Zeile). Mit Medien steht der Name
          // schon aus dem presign auf der Zeile; der Handler ignoriert ihn dann bewusst.
          guestName: trimmedName !== '' ? trimmedName : undefined,
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
  }, [comment, name, answers, rating, selectedFile, eventId, uploadMedia])

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
        <div className="gs-guest-step">
          {description && <p className="gs-guest-lead">{description}</p>}
          <p className="gs-guest-text">{labels.landingHeadline}</p>

          <label className="gs-guest-consent">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            />
            <span>{labels.consentText}</span>
          </label>

          {error && (
            <p className="gs-guest-error" role="alert">
              {error}
            </p>
          )}

          <button
            onClick={handleConsentContinue}
            disabled={!consentChecked}
            className="btn btn-primary gs-guest-btn"
          >
            Weiter
          </button>
        </div>
      )}

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      {step === 'feedback' && (
        <div className="gs-guest-step">
          <div className="gs-guest-field">
            <label htmlFor="guest-name" className="gs-guest-label">
              {namePrompt} <span className="gs-guest-optional">(optional)</span>
            </label>
            <input
              id="guest-name"
              className="input"
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
            />
          </div>

          <div className="gs-guest-field">
            <p className="gs-guest-label">{labels.ratingPrompt}</p>
            <GuestStars label={labels.ratingPrompt} value={rating} onChange={setRating} />
          </div>

          {/* Strukturierte Zusatzfragen (aus dem Kampagnen-Katalog) — alle optional. */}
          {questions.length > 0 && (
            <div className="gs-guest-questions">
              {questions.map((q) => (
                <div key={q.id} className="gs-guest-question">
                  <span className="gs-guest-label">{q.prompt}</span>
                  <GuestStars
                    label={q.prompt}
                    value={answers[q.id] ?? 0}
                    onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="gs-guest-field">
            <label htmlFor="comment" className="gs-guest-label">
              {labels.commentPrompt}
            </label>
            <textarea
              id="comment"
              className="input"
              rows={4}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={labels.commentPlaceholder}
            />
          </div>

          <GuestPick
            empty="Foto/Video anhängen (optional)"
            chosen={selectedFile?.name ?? null}
            hint="JPEG, PNG, MP4 oder MOV · Max. 50 MB"
            onChange={handleFileSelect}
          />

          {error && (
            <p className="gs-guest-error" role="alert">
              {error}
            </p>
          )}

          <button onClick={handleSubmit} className="btn btn-primary gs-guest-btn">
            Absenden
          </button>
        </div>
      )}

      {/* ── Submitting ───────────────────────────────────────────────────── */}
      {step === 'submitting' && (
        <div className="gs-guest-wait">
          <p className="gs-guest-label">Wird gesendet…</p>
          {selectedFile && (
            <>
              <div className="gs-guest-progress">
                <i style={{ width: `${progress}%` }} />
              </div>
              <p className="gs-guest-progress-label" aria-live="polite">
                {progress}%
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="gs-guest-done">
          <span className="gs-guest-done-mark" aria-hidden="true">
            🙏
          </span>
          <h2 className="gs-guest-done-title">{labels.successText}</h2>
          <p className="gs-guest-lead">Dein Feedback wurde übermittelt.</p>

          {submissionId && (
            <button onClick={handleDelete} className="gs-guest-quiet">
              Feedback löschen (DSGVO)
            </button>
          )}
        </div>
      )}
    </GuestShell>
  )
}
