'use client'

import { useCallback, useState } from 'react'

import type { GuestFlowLabels } from '@/lib/sectors'

import { GuestPick } from './GuestPick'
import GuestShell from './GuestShell'
import { GuestStars } from './GuestStars'

type Step = 'landing' | 'form' | 'submitting' | 'success' | 'gallery'

type GalleryItem = {
  id: string
  mediaUrl: string | null
  fileType: 'image' | 'video'
  caption: string | null
}

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

export default function GalleryFlow({ eventId, eventName, brandName, description, labels }: Props) {
  // Strukturierte Zusatzfragen aus dem Kampagnen-Katalog (leer, wenn der Typ keinen definiert).
  // Defensiv gegen ein Payload ohne questions (z. B. veralteter fetch-Cache) — wie in FeedbackFlow.
  // Nach `rating` gefiltert, weil dieser Flow Sterne rendert: eine Freitextfrage im Katalog (die
  // es hier heute nicht gibt) bekäme sonst Sterne und schickte eine Zahl an ein Textfeld — die
  // DB-Validierung (validate_feedback_answers) würde den ganzen Beitrag ablehnen.
  const questions = (labels.questions ?? []).filter((q) => q.type === 'rating')
  const [step, setStep] = useState<Step>('landing')
  const [consentChecked, setConsentChecked] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rating, setRating] = useState<number>(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)

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
    setSelectedFile(e.target.files?.[0] ?? null)
    setError(null)
  }, [])

  // Ein Submit: Medien-Upload (presign → PUT → confirm), danach Bewertung + Beschreibung +
  // strukturierte Antworten ownership-geprüft an denselben Beitrag anhängen (attach_feedback via
  // /feedback). Medien sind Pflicht (Galerie); Bewertung, Beschreibung und Antworten sind optional.
  const handleSubmit = useCallback(async () => {
    if (!selectedFile) {
      setError('Bitte wähle ein Foto oder Video aus.')
      return
    }
    setError(null)
    setStep('submitting')
    setProgress(0)

    try {
      const presignRes = await fetch('/api/submissions/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          consent: true,
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

      await uploadWithProgress(presignedUrl, selectedFile, setProgress)

      const confirmRes = await fetch(`/api/submissions/${sid}/confirm`, { method: 'PATCH' })
      if (!confirmRes.ok) throw new Error('Confirm failed')
      setSubmissionId(sid)

      const trimmed = comment.trim()
      const hasAnswers = Object.keys(answers).length > 0
      if (rating > 0 || trimmed !== '' || hasAnswers) {
        // Fehler hier sind nicht kritisch für den Upload — der Beitrag ist bereits gespeichert.
        await fetch(`/api/events/${eventId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: rating > 0 ? rating : undefined,
            comment: trimmed !== '' ? trimmed : undefined,
            answers: hasAnswers ? answers : undefined,
            submissionId: sid,
          }),
        })
      }

      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.')
      setStep('form')
    }
  }, [selectedFile, rating, comment, answers, eventId])

  const handleViewGallery = useCallback(async () => {
    setGalleryLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/gallery`)
      if (res.ok) {
        const body = (await res.json()) as { items: GalleryItem[] }
        setGallery(body.items ?? [])
      }
    } finally {
      setGalleryLoading(false)
      setStep('gallery')
    }
  }, [eventId])

  const handleDelete = useCallback(async () => {
    if (!submissionId) return
    if (!confirm('Möchtest du deinen Beitrag wirklich löschen?')) return
    try {
      await fetch(`/api/submissions/${submissionId}`, { method: 'DELETE' })
      setSubmissionId(null)
      alert('Dein Beitrag wurde gelöscht.')
    } catch {
      alert('Löschen fehlgeschlagen. Bitte versuche es erneut.')
    }
  }, [submissionId])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <GuestShell brandName={brandName} eventName={eventName}>
      {/* ── Landing (Consent) ────────────────────────────────────────────── */}
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

      {/* ── Ein Kart: Foto + Bewertung + Beschreibung ────────────────────── */}
      {step === 'form' && (
        <div className="gs-guest-step">
          <GuestPick
            label="Foto oder Video"
            empty="Foto oder Video auswählen"
            chosen={selectedFile?.name ?? null}
            hint="JPEG, PNG, MP4 oder MOV · Max. 50 MB"
            onChange={handleFileSelect}
          />

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
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={labels.commentPlaceholder}
            />
          </div>

          {error && (
            <p className="gs-guest-error" role="alert">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selectedFile}
            className="btn btn-primary gs-guest-btn"
          >
            Hochladen
          </button>
        </div>
      )}

      {/* ── Uploading ────────────────────────────────────────────────────── */}
      {step === 'submitting' && (
        <div className="gs-guest-wait">
          <p className="gs-guest-label">Wird hochgeladen…</p>
          <div className="gs-guest-progress">
            <i style={{ width: `${progress}%` }} />
          </div>
          {/* Der Prozentwert ist die einzige Auskunft in dieser Wartezeit — er soll auch dort
              ankommen, wo der Bildschirm nicht gelesen wird. */}
          <p className="gs-guest-progress-label" aria-live="polite">
            {progress}%
          </p>
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="gs-guest-done">
          <span className="gs-guest-done-mark" aria-hidden="true">
            🎉
          </span>
          <h2 className="gs-guest-done-title">{labels.successText}</h2>
          <p className="gs-guest-lead">
            Dein Beitrag wird kurz geprüft und dann in der Galerie erscheinen.
          </p>

          <button onClick={handleViewGallery} className="btn btn-primary gs-guest-btn">
            Galerie ansehen
          </button>

          {submissionId && (
            <button onClick={handleDelete} className="gs-guest-quiet">
              Beitrag löschen (DSGVO)
            </button>
          )}
        </div>
      )}

      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      {step === 'gallery' && (
        <div className="gs-guest-step">
          <p className="gs-guest-label">Galerie</p>

          {galleryLoading ? (
            <p className="gs-guest-empty">Wird geladen…</p>
          ) : gallery.length === 0 ? (
            <p className="gs-guest-empty">Noch keine Beiträge. Sei der Erste!</p>
          ) : (
            <div className="gs-guest-grid">
              {gallery.map((item) =>
                item.mediaUrl ? (
                  <figure key={item.id} className="gs-guest-tile">
                    {item.fileType === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.mediaUrl} alt={item.caption ?? ''} />
                    ) : (
                      <video src={item.mediaUrl} muted playsInline preload="metadata" />
                    )}
                    {item.caption && item.caption.trim() !== '' && (
                      <figcaption>{item.caption}</figcaption>
                    )}
                  </figure>
                ) : null,
              )}
            </div>
          )}

          <button
            onClick={() => {
              setSelectedFile(null)
              setRating(0)
              setAnswers({})
              setComment('')
              setStep('form')
            }}
            className="btn btn-secondary gs-guest-btn"
          >
            Weiteres Foto hochladen
          </button>
        </div>
      )}
    </GuestShell>
  )
}
