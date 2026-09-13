import { normalizeYouTubeUrl, resolveYouTubeAvatar } from './youtubeAvatar.js'
import { resolveCachedPopularFeedVideos } from './youtubeFeed.js'
import { enforceRateLimit, type ApiRequest } from './rateLimit.js'
import { PublicError } from './safeFetch.js'

export type ApiResponse = {
  setHeader(name: string, value: string): void
  status(code: number): ApiResponse
  json(body: unknown): void
}
export async function handleApi(endpoint: 'avatar' | 'feed', req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Use GET.' })
  }
  try {
    const raw = req.query.url
    const channel = endpoint === 'avatar'
      ? normalizeYouTubeUrl(typeof raw === 'string' ? raw : '')
      : null
    await enforceRateLimit(req, endpoint)
    const result = channel ? await resolveYouTubeAvatar(channel.href) : { videos: await resolveCachedPopularFeedVideos('US') }
    res.setHeader('Cache-Control', endpoint === 'avatar' ? 's-maxage=86400' : 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json(result)
  } catch (error) {
    const safe = error instanceof PublicError ? error : new PublicError('Live YouTube lookup is unavailable. Try again later.', 503)
    if (safe.retryAfter) res.setHeader('Retry-After', String(safe.retryAfter))
    return res.status(safe.status).json({ error: safe.message })
  }
}
