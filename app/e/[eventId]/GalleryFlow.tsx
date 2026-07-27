'use client'

import { useCallback, useRef, useState } from 'react'

import type { GuestFlowLabels } from '@/lib/campaigns/config'

import GuestShell from './GuestShell'

type Step = 'landing' | 'upload' | 'uploading' | 'success' | 'rating' | 'gallery'

type GalleryItem = {
  id: string
  signedUrl: string | null
  file_type: 'image' | 'video'
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
  const [step, setStep] = useState<Step>('landing')
  const [consentChecked, setConsentChecked] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [rating, setRating] = useState<number>(0)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConsentContinue = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (!res.ok) throw new Error('Session creation failed')
      setStep('upload')
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setError(null)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return
    setError(null)
    setStep('uploading')
    setProgress(0)

    try {
      const presignRes = await fetch('/api/submissions/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
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
      setSubmissionId(sid)

      await uploadWithProgress(presignedUrl, selectedFile, setProgress)

      const confirmRes = await fetch(`/api/submissions/${sid}/confirm`, { method: 'PATCH' })
      if (!confirmRes.ok) throw new Error('Confirm failed')

      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.')
      setStep('upload')
    }
  }, [selectedFile, eventId])

  const handleRating = useCallback(
    async (stars: number) => {
      if (!submissionId) return
      setRating(stars)
      try {
        await fetch(`/api/submissions/${submissionId}/rate`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: stars }),
        })
        setRatingSubmitted(true)
      } catch {
        // Rating is optional; silent failure is acceptable
      }
    },
    [submissionId],
  )

  const handleViewGallery = useCallback(async () => {
    setGalleryLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/gallery`)
      if (res.ok) {
        const body = (await res.json()) as { submissions: GalleryItem[] }
        setGallery(body.submissions ?? [])
      }
    } finally {
      setGalleryLoading(false)
      setStep('gallery')
    }
  }, [eventId])

  const handleDelete = useCallback(async () => {
    if (!submissionId) return
    if (!confirm('Möchtest du dein Foto/Video wirklich löschen?')) return
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

      {/* ── Upload ───────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-gray-700 font-medium">Foto oder Video auswählen</p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center
                       cursor-pointer hover:border-indigo-400 transition-colors"
          >
            {selectedFile ? (
              <p className="text-sm text-gray-700 truncate">{selectedFile.name}</p>
            ) : (
              <p className="text-sm text-gray-400">Hier klicken oder Datei ziehen</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,video/mp4,video/quicktime"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          <p className="text-xs text-gray-400">JPEG, PNG, MP4 oder MOV · Max. 50 MB</p>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={!selectedFile}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium
                       disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700
                       transition-colors"
          >
            Hochladen
          </button>
        </div>
      )}

      {/* ── Uploading ────────────────────────────────────────────────────── */}
      {step === 'uploading' && (
        <div className="space-y-4 py-4">
          <p className="text-gray-700 font-medium text-center">Wird hochgeladen…</p>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-500">{progress}%</p>
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">🎉</div>
          <p className="text-gray-800 font-semibold text-lg">{labels.successText}</p>
          <p className="text-gray-500 text-sm">
            Dein Upload wird kurz geprüft und dann in der Galerie erscheinen.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('rating')}
              className="flex-1 py-2.5 px-4 border border-indigo-600 text-indigo-600
                         rounded-xl font-medium hover:bg-indigo-50 transition-colors text-sm"
            >
              Bewerten
            </button>
            <button
              onClick={handleViewGallery}
              className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-medium
                         hover:bg-indigo-700 transition-colors text-sm"
            >
              Galerie
            </button>
          </div>

          {submissionId && (
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-600 underline mt-2"
            >
              Beitrag löschen (DSGVO)
            </button>
          )}
        </div>
      )}

      {/* ── Rating ───────────────────────────────────────────────────────── */}
      {step === 'rating' && (
        <div className="space-y-4 text-center">
          <p className="text-gray-700 font-medium">{labels.ratingPrompt}</p>

          {ratingSubmitted ? (
            <div className="space-y-4">
              <p className="text-2xl">
                {'★'.repeat(rating)}
                {'☆'.repeat(5 - rating)}
              </p>
              <p className="text-gray-500 text-sm">Danke für deine Bewertung!</p>
              <button
                onClick={handleViewGallery}
                className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-medium
                           hover:bg-indigo-700 transition-colors"
              >
                Galerie ansehen
              </button>
            </div>
          ) : (
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  className="text-4xl hover:scale-110 transition-transform"
                >
                  {star <= rating ? '★' : '☆'}
                </button>
              ))}
            </div>
          )}

          {!ratingSubmitted && (
            <button
              onClick={handleViewGallery}
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Überspringen
            </button>
          )}
        </div>
      )}

      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      {step === 'gallery' && (
        <div className="space-y-4">
          <p className="text-gray-700 font-medium">Galerie</p>

          {galleryLoading ? (
            <p className="text-center text-gray-400 text-sm py-8">Wird geladen…</p>
          ) : gallery.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Noch keine Beiträge. Sei der Erste!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {gallery.map((item) =>
                item.signedUrl ? (
                  item.file_type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={item.id}
                      src={item.signedUrl}
                      alt=""
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                  ) : (
                    <video
                      key={item.id}
                      src={item.signedUrl}
                      className="w-full aspect-square object-cover rounded-lg"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )
                ) : null,
              )}
            </div>
          )}

          <button
            onClick={() => setStep('upload')}
            className="w-full py-2.5 px-4 border border-indigo-600 text-indigo-600
                       rounded-xl font-medium hover:bg-indigo-50 transition-colors text-sm"
          >
            Weiteres Foto hochladen
          </button>
        </div>
      )}
    </GuestShell>
  )
}
