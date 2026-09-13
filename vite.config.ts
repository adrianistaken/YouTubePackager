import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { ApiRequest } from './server/rateLimit'
import { handleApi, type ApiResponse } from './api/_lib/api'

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['YOUTUBE_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    process.env[key] ||= env[key]
  }
  return {
    plugins: [vue(), {
      name: 'youtube-packager-api',
      configureServer(server) {
        for (const [path, endpoint] of [['/api/youtube-avatar', 'avatar'], ['/api/feed-videos', 'feed']] as const) {
          server.middlewares.use(path, async (req, res) => {
            const incoming = req as typeof req & ApiRequest & { url?: string }
            const url = new URL(incoming.url ?? '', 'http://localhost')
            const query: ApiRequest['query'] = {}
            url.searchParams.forEach((value, key) => { query[key] = value })
            const response: ApiResponse = {
              setHeader: (name, value) => { res.setHeader(name, value) },
              status: (code) => { res.statusCode = code; return response },
              json: (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) },
            }
            await handleApi(endpoint, { method: incoming.method, headers: incoming.headers, socket: incoming.socket, query }, response)
          })
        }
      },
    }],
  }
})
