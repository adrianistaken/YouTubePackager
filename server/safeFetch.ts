export class PublicError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) {
    super(message)
  }
}

export function requireHttps(url: URL, hosts: ReadonlySet<string>) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.has(url.hostname)) {
    throw new PublicError('This URL is not supported. Use a public YouTube channel URL.')
  }
}

// Validate every hop before making a request. The timeout covers headers AND the body.
export async function safeFetch(
  input: string,
  validate: (url: URL) => void,
  maxBytes: number,
  accept: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    let url = new URL(input)
    for (let hop = 0; hop <= 3; hop++) {
      validate(url)
      const response = await fetch(url, {
        redirect: 'manual', signal: controller.signal,
        headers: { accept, 'accept-language': 'en-US,en;q=0.9' },
      })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel()
        const location = response.headers.get('location')
        if (!location) throw new PublicError('The remote service returned an invalid redirect.')
        url = new URL(location, url)
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new PublicError('The remote service is unavailable. Try again later.', 503)
      }
      if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel()
        throw new PublicError('The remote image or page is too large.')
      }
      const reader = response.body?.getReader()
      if (!reader) throw new PublicError('The remote response was empty.')
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > maxBytes) throw new PublicError('The remote image or page is too large.')
          chunks.push(value)
        }
      } finally {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      return { bytes, contentType: (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() }
    }
    throw new PublicError('The remote service redirected too many times.')
  } catch (error) {
    if (error instanceof PublicError) throw error
    throw new PublicError('The remote request failed or timed out. Try again later.', 503)
  } finally {
    clearTimeout(timer)
  }
}

const GOOGLE_API_HOSTS = new Set(['www.googleapis.com'])
export async function fetchYouTubeJson<T>(url: string): Promise<T> {
  const result = await safeFetch(url, (target) => requireHttps(target, GOOGLE_API_HOSTS), 512 * 1024, 'application/json')
  return JSON.parse(new TextDecoder().decode(result.bytes)) as T
}
