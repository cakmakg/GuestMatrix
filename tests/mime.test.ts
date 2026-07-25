import { beforeEach, describe, expect, it, vi } from 'vitest'

// Must mock fetch before the module is imported
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFetchResponse(bytes: number[]) {
  const buffer = new Uint8Array(bytes).buffer
  return Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(buffer),
  } as unknown as Response)
}

// Dynamic import ensures the global mock is in place first
const { validateFileMime } = await import('@/lib/storage/mime')

describe('validateFileMime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detects JPEG via FF D8 FF magic bytes', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
    )
    const result = await validateFileMime('https://storage.example.com/img.jpg')
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.detectedMime).toBe('image/jpeg')
  })

  it('detects PNG via 89 50 4E 47 magic bytes', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    )
    const result = await validateFileMime('https://storage.example.com/img.png')
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.detectedMime).toBe('image/png')
  })

  it('detects MP4 via ftyp box with isom brand', async () => {
    // 4 bytes box size + "ftyp" + "isom"
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
    )
    const result = await validateFileMime('https://storage.example.com/video.mp4')
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.detectedMime).toBe('video/mp4')
  })

  it('detects QuickTime via ftyp box with qt brand', async () => {
    // "qt  " brand (with trailing spaces)
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]),
    )
    const result = await validateFileMime('https://storage.example.com/video.mov')
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.detectedMime).toBe('video/quicktime')
  })

  it('rejects GIF (not in allow-list)', async () => {
    // GIF magic: 47 49 46 38
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]),
    )
    const result = await validateFileMime('https://storage.example.com/anim.gif')
    expect(result.valid).toBe(false)
    expect(result.detectedMime).toBeNull()
  })

  it('returns invalid when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const result = await validateFileMime('https://storage.example.com/file.jpg')
    expect(result.valid).toBe(false)
  })

  it('returns invalid when response status is not ok', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: false } as Response))
    const result = await validateFileMime('https://storage.example.com/file.jpg')
    expect(result.valid).toBe(false)
  })

  it('passes Range header to fetch', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
    )
    await validateFileMime('https://storage.example.com/img.jpg')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://storage.example.com/img.jpg',
      expect.objectContaining({ headers: { Range: 'bytes=0-11' } }),
    )
  })
})
