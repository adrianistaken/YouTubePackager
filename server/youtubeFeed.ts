import type { FeedVideo } from '../src/types'

type YouTubeVideoItem = {
  id: string
  snippet: {
    title: string
    channelId: string
    channelTitle: string
    publishedAt: string
    thumbnails: Record<string, { url: string }>
  }
  statistics?: {
    viewCount?: string
  }
  contentDetails?: {
    duration?: string
  }
}

type YouTubeChannelItem = {
  id: string
  snippet: {
    thumbnails: Record<string, { url: string }>
  }
}

type CachedFeed = {
  expiresAt: number
  staleUntil: number
  videos: FeedVideo[]
}

const LIVE_FEED_CACHE_MS = 60 * 60 * 1000
const LIVE_FEED_STALE_MS = 24 * 60 * 60 * 1000
const feedCache = new Map<string, CachedFeed>()
const pendingFeedRequests = new Map<string, Promise<FeedVideo[]>>()

export async function resolveCachedPopularFeedVideos(regionCode = 'US'): Promise<FeedVideo[]> {
  const normalizedRegion = normalizeRegionCode(regionCode)
  const cached = feedCache.get(normalizedRegion)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    return cached.videos
  }

  const pending = pendingFeedRequests.get(normalizedRegion)
  if (pending) {
    return pending
  }

  const request = resolvePopularFeedVideos(normalizedRegion)
    .then((videos) => {
      feedCache.set(normalizedRegion, {
        expiresAt: now + LIVE_FEED_CACHE_MS,
        staleUntil: now + LIVE_FEED_STALE_MS,
        videos,
      })
      return videos
    })
    .catch((error) => {
      if (cached && cached.staleUntil > now) {
        return cached.videos
      }

      throw error
    })
    .finally(() => {
      pendingFeedRequests.delete(normalizedRegion)
    })

  pendingFeedRequests.set(normalizedRegion, request)
  return request
}

export async function resolvePopularFeedVideos(regionCode = 'US'): Promise<FeedVideo[]> {
  const apiKey = getYouTubeApiKey()
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured.')
  }

  const videoParams = new URLSearchParams({
    key: apiKey,
    part: 'snippet,statistics,contentDetails',
    chart: 'mostPopular',
    regionCode: normalizeRegionCode(regionCode),
    maxResults: '12',
    fields:
      'items(id,snippet(title,channelId,channelTitle,publishedAt,thumbnails),statistics(viewCount),contentDetails(duration))',
  })

  const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videoParams}`)
  if (!videoResponse.ok) {
    throw new Error(`YouTube videos API returned ${videoResponse.status}.`)
  }

  const videoBody = (await videoResponse.json()) as { items?: YouTubeVideoItem[] }
  const items = videoBody.items ?? []
  const channelIds = [...new Set(items.map((item) => item.snippet.channelId))].join(',')
  const channelAvatars = channelIds ? await resolveChannelAvatars(apiKey, channelIds) : new Map<string, string>()

  return items.map((item, index) => ({
    id: item.id,
    title: item.snippet.title,
    channelName: item.snippet.channelTitle,
    views: formatViews(Number(item.statistics?.viewCount ?? 0)),
    publishTime: formatRelativeTime(item.snippet.publishedAt),
    duration: formatDuration(item.contentDetails?.duration),
    thumbnail: bestThumbnail(item.snippet.thumbnails),
    avatar: channelAvatars.get(item.snippet.channelId) ?? null,
    accent: fallbackAccents[index % fallbackAccents.length],
  }))
}

function normalizeRegionCode(regionCode: string) {
  const normalized = regionCode.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : 'US'
}

async function resolveChannelAvatars(apiKey: string, ids: string) {
  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    id: ids,
    maxResults: '50',
    fields: 'items(id,snippet(thumbnails))',
  })

  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`)
  if (!response.ok) {
    return new Map<string, string>()
  }

  const body = (await response.json()) as { items?: YouTubeChannelItem[] }
  return new Map(
    (body.items ?? [])
      .map((item) => [item.id, bestThumbnail(item.snippet.thumbnails)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  )
}

function bestThumbnail(thumbnails: Record<string, { url: string }>) {
  return (
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.standard?.url ??
    thumbnails.maxres?.url ??
    thumbnails.default?.url ??
    null
  )
}

function formatViews(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 views'
  if (value >= 1_000_000_000) return `${trimNumber(value / 1_000_000_000)}B views`
  if (value >= 1_000_000) return `${trimNumber(value / 1_000_000)}M views`
  if (value >= 1_000) return `${trimNumber(value / 1_000)}K views`
  return `${value} views`
}

function formatRelativeTime(dateString: string) {
  const published = new Date(dateString).getTime()
  const diffMs = Date.now() - published
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day

  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))} minutes ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hours ago`
  if (diffMs < week) return `${Math.floor(diffMs / day)} days ago`
  if (diffMs < month) return `${Math.floor(diffMs / week)} weeks ago`
  if (diffMs < year) return `${Math.floor(diffMs / month)} months ago`
  return `${Math.floor(diffMs / year)} years ago`
}

function formatDuration(duration = '') {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return '0:00'

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  const paddedSeconds = seconds.toString().padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`
  }

  return `${minutes}:${paddedSeconds}`
}

function trimNumber(value: number) {
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '')
}

function getYouTubeApiKey() {
  return (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.YOUTUBE_API_KEY
}

const fallbackAccents = ['#4f46e5', '#db2777', '#ea580c', '#0891b2', '#16a34a', '#7c3aed']
