'use client'

import { useCallback, useState } from 'react'

import type { GuestFlowLabels } from '@/lib/sectors'

import { GuestPick } from './GuestPick'
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
  // Optionale strukturierte Kurzfragen (z. B. „drei Worte"), key = Fragen-id.
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState(0)
  const [fileIndex, setFileIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submissionIds, setSubmissionIds] = useState<string[]>([])

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
    async (
      file: File,
      trimmedName: string,
      trimmedMessage: string,
      answersPayload?: Record<string, string>,
    ): Promise<string> => {
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
          answers: answersPayload,
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

    // Strukturierte Antworten (z. B. „drei Worte") einmalig senden: am ersten Medienbeitrag, sonst
    // am medienlosen Gruß. Leere Felder werden weggelassen (alle Fragen sind optional).
    const trimmedAnswers: Record<string, string> = {}
    for (const [key, value] of Object.entries(answers)) {
      const v = value.trim()
      if (v !== '') trimmedAnswers[key] = v
    }
    const answersPayload = Object.keys(trimmedAnswers).length > 0 ? trimmedAnswers : undefined

    try {
      const ids: string[] = []

      // Beiträge mit Medien: pro Datei ein Submission-Datensatz (Name + Gruß je Datei). Die
      // Antworten hängen nur am ERSTEN Beitrag (einmal pro Gast, nicht pro Datei).
      for (const [i, file] of files.entries()) {
        setFileIndex(i)
        setProgress(0)
        ids.push(
          await uploadOne(file, trimmedName, trimmedMessage, i === 0 ? answersPayload : undefined),
        )
      }

      // Reiner Glückwunsch ohne Medien: separater medienloser Beitrag.
      if (files.length === 0 && trimmedMessage !== '') {
        const res = await fetch(`/api/events/${eventId}/guestbook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestName: trimmedName,
            message: trimmedMessage,
            consent: true,
            answers: answersPayload,
          }),
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
  }, [name, message, answers, files, eventId, uploadOne])

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

      {/* ── Form (Name + Glückwunsch + Medien) ───────────────────────────── */}
      {step === 'form' && (
        <div className="gs-guest-step">
          <div className="gs-guest-field">
            <label htmlFor="guest-name" className="gs-guest-label">
              {namePrompt}
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
            <label htmlFor="message" className="gs-guest-label">
              {labels.commentPrompt}
            </label>
            <textarea
              id="message"
              className="input"
              rows={4}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={labels.commentPlaceholder}
            />
          </div>

          {/* Optionale strukturierte Kurzfragen (Freitext) aus dem Kampagnentyp-Katalog. */}
          {labels.questions
            .filter((q) => q.type === 'text')
            .map((q) => (
              <div key={q.id} className="gs-guest-field">
                <label htmlFor={`q-${q.id}`} className="gs-guest-label">
                  {q.prompt} <span className="gs-guest-optional">(optional)</span>
                </label>
                <input
                  id={`q-${q.id}`}
                  className="input"
                  type="text"
                  maxLength={q.maxLength ?? 280}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              </div>
            ))}

          <GuestPick
            empty="Fotos/Videos hinzufügen (optional)"
            chosen={
              files.length === 0
                ? null
                : files.length === 1
                  ? (files[0]?.name ?? null)
                  : `${files.length} Dateien ausgewählt`
            }
            hint={`JPEG, PNG, MP4 oder MOV · max. ${MAX_FILES} Dateien · je max. 50 MB`}
            multiple
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
          {files.length > 0 && (
            <>
              <div className="gs-guest-progress">
                <i style={{ width: `${progress}%` }} />
              </div>
              <p className="gs-guest-progress-label" aria-live="polite">
                {files.length > 1 ? `Datei ${fileIndex + 1} von ${files.length} · ` : ''}
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
            💐
          </span>
          <h2 className="gs-guest-done-title">{labels.successText}</h2>
          <p className="gs-guest-lead">Das Brautpaar freut sich über euren Beitrag.</p>

          {submissionIds.length > 0 && (
            <button onClick={handleDelete} className="gs-guest-quiet">
              Beitrag löschen (DSGVO)
            </button>
          )}
        </div>
      )}
    </GuestShell>
  )
}
