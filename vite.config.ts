import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolveYouTubeAvatar } from './server/youtubeAvatar'
import { resolveCachedPopularFeedVideos } from './server/youtubeFeed'

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.YOUTUBE_API_KEY ||= env.YOUTUBE_API_KEY

  return {
    plugins: [
      vue(),
      {
        name: 'youtube-packager-api',
        configureServer(server) {
        server.middlewares.use('/api/youtube-avatar', async (req: any, res: any) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Use GET.' }))
            return
          }

          const requestUrl = new URL(req.url ?? '', 'http://localhost')
          const channelUrl = requestUrl.searchParams.get('url')

          if (!channelUrl) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Paste a YouTube channel URL.' }))
            return
          }

          try {
            const result = await resolveYouTubeAvatar(channelUrl)
            res.statusCode = 200
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          } catch (error) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : 'Could not resolve the channel avatar.',
              }),
            )
          }
        })

        server.middlewares.use('/api/feed-videos', async (req: any, res: any) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Use GET.' }))
            return
          }

          const requestUrl = new URL(req.url ?? '', 'http://localhost')
          const regionCode = requestUrl.searchParams.get('region') ?? 'US'

          try {
            const videos = await resolveCachedPopularFeedVideos(regionCode)
            res.statusCode = 200
            res.setHeader('Cache-Control', 'public, max-age=3600')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ videos }))
          } catch (error) {
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : 'Live feed videos are unavailable.',
              }),
            )
          }
        })
        },
      },
    ],
  }
})
