'use client'

type Props = {
  qrDataUrl: string
  guestUrl: string
}

export default function QrSection({ qrDataUrl, guestUrl }: Props) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(guestUrl)
    alert('Link kopiert!')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center gap-4">
      <p className="text-sm font-medium text-gray-700">QR-Code für Gäste</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="QR-Code" className="w-40 h-40" />
      <div className="flex gap-2 w-full">
        <button
          onClick={handleCopy}
          className="flex-1 py-2 px-3 border border-gray-300 text-gray-700 text-xs rounded-lg
                     hover:bg-gray-50 transition-colors"
        >
          Link kopieren
        </button>
        <a
          href={qrDataUrl}
          download="qr-code.png"
          className="flex-1 py-2 px-3 bg-indigo-600 text-white text-xs rounded-lg text-center
                     hover:bg-indigo-700 transition-colors"
        >
          QR herunterladen
        </a>
      </div>
      <p className="text-xs text-gray-400 break-all text-center">{guestUrl}</p>
    </div>
  )
}
