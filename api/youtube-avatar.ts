type VercelRequest = {
  method?: string
  query: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  setHeader(name: string, value: string): void
  status(code: number): VercelResponse
  json(body: unknown): void
}

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
  from(input: ArrayBuffer): { toString(encoding: 'base64'): string }
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'studio.youtube.com',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')

  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET.' })
  }

  const urlParam = req.query.url
  const channelUrl = Array.isArray(urlParam) ? urlParam[0] : urlParam

  if (!channelUrl) {
    return res.status(400).json({ error: 'Paste a YouTube channel URL.' })
  }

  try {
    return res.status(200).json(await resolveYouTubeAvatar(channelUrl))
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Could not resolve the channel avatar.',
    })
  }
}

async function resolveYouTubeAvatar(channelUrl: string): Promise<AvatarResult> {
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

  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`)
  if (!response.ok) {
    return null
  }

  const body = (await response.json()) as { items?: YouTubeChannelItem[] }
  const item = body.items?.[0]
  const avatarUrl = item?.snippet.thumbnails ? bestAvatarThumbnail(item.snippet.thumbnails) : null

  return avatarUrl
    ? {
        avatarUrl,
        channelName: item.snippet.title ?? null,
      }
    : null
}

async function resolveWithPageHtml(url: URL) {
  const pageResponse = await fetch(url.href, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  })

  if (!pageResponse.ok) {
    throw new Error(`YouTube returned ${pageResponse.status}`)
  }

  const html = await pageResponse.text()
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
  const avatarResponse = await fetch(result.avatarUrl, {
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  })

  if (!avatarResponse.ok) {
    throw new Error(`Avatar image returned ${avatarResponse.status}`)
  }

  const contentType = avatarResponse.headers.get('content-type') ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new Error('Resolved avatar was not an image.')
  }

  const imageBuffer = await avatarResponse.arrayBuffer()
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

function resolveChannelFilter(url: URL) {
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

function normalizeYouTubeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    throw new Error('Paste a YouTube channel URL.')
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProtocol)
  const hostname = url.hostname.toLowerCase()

  if (!YOUTUBE_HOSTS.has(hostname)) {
    throw new Error('Use a youtube.com channel URL.')
  }

  if (hostname === 'studio.youtube.com') {
    throw new Error('Use the public channel URL, not YouTube Studio.')
  }

  return url
}

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
