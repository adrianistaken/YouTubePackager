import { onMounted, ref } from 'vue'
import { fallbackFeedVideos } from '../data/contextVideos'
import type { FeedVideo } from '../types'

export function useFeedVideos() {
  const videos = ref<FeedVideo[]>(fallbackFeedVideos)
  const status = ref<'fallback' | 'loading' | 'live' | 'error'>('fallback')

  onMounted(async () => {
    status.value = 'loading'

    try {
      const response = await fetch('/api/feed-videos')
      if (!response.ok) {
        throw new Error('Live feed unavailable')
      }

      const body = (await response.json()) as { videos?: FeedVideo[] }
      if (Array.isArray(body.videos) && body.videos.length >= 6) {
        videos.value = body.videos
        status.value = 'live'
        return
      }

      throw new Error('Live feed returned too few videos')
    } catch {
      videos.value = fallbackFeedVideos
      status.value = 'fallback'
    }
  })

  return { videos, status }
}
