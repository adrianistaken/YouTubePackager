import { safeFetch, requireHttps, fetchYouTubeJson, PublicError } from './safeFetch.js'

type AvatarResult = {
  avatarDataUrl: string
  avatarUrl: string
  channelName: string | null
}

type YouTubeChannelItem = {
  snippet: {
    title?: string
    thumbnails?: Record<string, { url: string }>
  }
}

type BufferLike = {
  from(input: Uint8Array): { toString(encoding: 'base64'): string }
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'studio.youtube.com',
])

export async function resolveYouTubeAvatar(channelUrl: string): Promise<AvatarResult> {
  const url = normalizeYouTubeUrl(channelUrl)
  const apiResult = await resolveWithYouTubeApi(url).catch(() => null)

  if (apiResult) {
    return withImageData(apiResult)
  }

  return withImageData(await resolveWithPageHtml(url))
}

async function resolveWithYouTubeApi(url: URL) {
  const apiKey = getYouTubeApiKey()
  const filter = resolveChannelFilter(url)

  if (!apiKey || !filter) {
    return null
  }

  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    maxResults: '1',
    fields: 'items(snippet(title,thumbnails))',
    ...filter,
  })

  const body = await fetchYouTubeJson<{ items?: YouTubeChannelItem[] }>(`https://www.googleapis.com/youtube/v3/channels?${params}`)
  const item = body.items?.[0]
  const avatarUrl = item?.snippet.thumbnails ? bestAvatarThumbnail(item.snippet.thumbnails) : null

  return avatarUrl
    ? {
        avatarUrl,
        channelName: item?.snippet.title ?? null,
      }
    : null
}

async function resolveWithPageHtml(url: URL) {
  const page = await safeFetch(url.href, validateChannelUrl, 4 * 1024 * 1024, 'text/html')
  if (page.contentType !== 'text/html') throw new PublicError('No public channel page was found.')
  const html = new TextDecoder().decode(page.bytes)
  const avatarUrl = extractAvatarUrl(html)
  if (!avatarUrl) {
    throw new Error('No channel avatar was found on that page.')
  }

  return {
    avatarUrl,
    channelName: extractMetaContent(html, 'og:title') ?? extractMetaContent(html, 'twitter:title'),
  }
}

async function withImageData(result: { avatarUrl: string; channelName: string | null }) {
  const image = await safeFetch(result.avatarUrl, validateImageUrl, 10 * 1024 * 1024, 'image/png,image/jpeg,image/webp')
  const contentType = image.contentType
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
    throw new PublicError('Resolved avatar must be PNG, JPEG, or WebP.')
  }
  const imageBuffer = image.bytes
  const buffer = (globalThis as typeof globalThis & { Buffer?: BufferLike }).Buffer
  if (!buffer) {
    throw new Error('Image encoding is not available in this runtime.')
  }

  return {
    avatarDataUrl: `data:${contentType};base64,${buffer.from(imageBuffer).toString('base64')}`,
    avatarUrl: result.avatarUrl,
    channelName: result.channelName,
  }
}

function resolveChannelFilter(url: URL): Record<string, string> | null {
  const [firstSegment, secondSegment] = url.pathname.split('/').filter(Boolean)

  if (firstSegment?.startsWith('@')) {
    return { forHandle: firstSegment }
  }

  if (firstSegment === 'channel' && secondSegment) {
    return { id: secondSegment }
  }

  if (firstSegment === 'user' && secondSegment) {
    return { forUsername: secondSegment }
  }

  return null
}

export function normalizeYouTubeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed.length > 2048) throw new PublicError('Paste a public YouTube channel URL.')
  let url: URL
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`) }
  catch { throw new PublicError('Paste a valid public YouTube channel URL.') }
  validateChannelUrl(url)
  // Tracking parameters and subpages must not create new upstream/cache identities.
  const segments = url.pathname.split('/').filter(Boolean)
  const path = segments[0].startsWith('@') ? segments[0] : segments.slice(0, 2).join('/')
  return new URL(`https://www.youtube.com/${path}`)
}

export function validateChannelUrl(url: URL) {
  requireHttps(url, YOUTUBE_HOSTS)
  if (url.hostname === 'studio.youtube.com') throw new PublicError('Use the public channel URL, not YouTube Studio.')
  if (!/^\/(?:@[^/]+|channel\/UC[A-Za-z0-9_-]{22}|(?:user|c)\/[^/]+)(?:\/(?:featured|videos|shorts|streams|playlists|community|about))?\/?$/.test(url.pathname)) {
    throw new PublicError('Use a channel URL such as youtube.com/@name, not a video or redirect link.')
  }
}

const IMAGE_HOSTS = new Set(['yt3.ggpht.com', 'yt3.googleusercontent.com', 'yt4.ggpht.com', 'yt4.googleusercontent.com', 'i.ytimg.com'])
export function validateImageUrl(url: URL) { requireHttps(url, IMAGE_HOSTS) }

function extractAvatarUrl(html: string) {
  const metaUrl =
    extractMetaContent(html, 'og:image') ??
    extractMetaContent(html, 'twitter:image') ??
    extractLinkImage(html)

  if (metaUrl) {
    return normalizeImageUrl(metaUrl)
  }

  const yt3Match = html.match(/https:\\?\/\\?\/yt3\.(?:ggpht|googleusercontent)\.com\/[^"'\\<>\s]+/i)
  return yt3Match ? normalizeImageUrl(yt3Match[0]) : null
}

function extractMetaContent(html: string, property: string) {
  const escaped = escapeRegExp(property)
  const regexes = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ]

  for (const regex of regexes) {
    const match = html.match(regex)
    if (match?.[1]) {
      return decodeHtml(match[1])
    }
  }

  return null
}

function extractLinkImage(html: string) {
  const match = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i)
  return match?.[1] ? decodeHtml(match[1]) : null
}

function bestAvatarThumbnail(thumbnails: Record<string, { url: string }>) {
  return (
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    thumbnails.high?.url ??
    null
  )
}

function normalizeImageUrl(url: string) {
  return decodeHtml(url)
    .replaceAll('\\u0026', '&')
    .replaceAll('\\/', '/')
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getYouTubeApiKey() {
  return (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.YOUTUBE_API_KEY
}
