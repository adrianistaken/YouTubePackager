import { PublicError } from './safeFetch'

export type ApiRequest = {
  method?: string
  query: Record<string, string | string[] | undefined>
  headers?: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}
const localCounters = new Map<string, { count: number; expires: number }>()
const SCRIPT = `
for i = 1, #KEYS do
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i * 2 - 1]) then
    return math.max(1, redis.call('TTL', KEYS[i]))
  end
end
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], ARGV[i * 2]) end
end
return 0
`

function env() {
  return (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
}

export async function enforceRateLimit(req: ApiRequest, endpoint: 'avatar' | 'feed') {
  const config = env()
  const production = config.NODE_ENV === 'production' || Boolean(config.VERCEL)
  // Only Vercel's overwritten header is trusted; arbitrary X-Forwarded-For is not.
  const address = config.VERCEL ? req.headers?.['x-vercel-forwarded-for'] : req.socket?.remoteAddress
  const identity = typeof address === 'string' && address.length <= 128 ? address : 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  const keys = [`yp:v1:${endpoint}:${hash}`, 'yp:v1:youtube:daily']
  const limits = [endpoint === 'avatar' ? 10 : 30, 2000]
  const windows = [60, 86400]
  const url = config.UPSTASH_REDIS_REST_URL
  const token = config.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    try {
      const target = new URL(url)
      if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Invalid counter endpoint')
      const response = await fetch(target, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', SCRIPT, keys.length, ...keys, limits[0], windows[0], limits[1], windows[1]]),
      })
      if (!response.ok) throw new Error('Counter unavailable')
      const body = await response.json() as { result?: unknown; error?: string }
      if (body.error || typeof body.result !== 'number' || !Number.isFinite(body.result) || body.result < 0) throw new Error('Invalid counter result')
      if (body.result > 0) throw new PublicError('Too many requests. Please try again later, or upload an avatar directly.', 429, Math.ceil(body.result))
      return
    } catch (error) {
      if (error instanceof PublicError) throw error
      throw new PublicError('Live YouTube lookup is temporarily unavailable. You can still upload images.', 503)
    }
  }
  // Never silently fall back to per-instance counters on a public deployment.
  if (production) throw new PublicError('Live YouTube lookup is temporarily unavailable. You can still upload images.', 503)
  const now = Date.now()
  for (const [key, value] of localCounters) if (value.expires <= now) localCounters.delete(key)
  if (localCounters.size > 10000) throw new PublicError('Too many requests. Try again later.', 429, 60)
  for (let i = 0; i < keys.length; i++) {
    const value = localCounters.get(keys[i])
    if (value && value.count >= limits[i]) throw new PublicError('Too many requests. Try again later.', 429, Math.ceil((value.expires - now) / 1000))
  }
  keys.forEach((key, i) => {
    const value = localCounters.get(key) ?? { count: 0, expires: now + windows[i] * 1000 }
    value.count++
    localCounters.set(key, value)
  })
}
