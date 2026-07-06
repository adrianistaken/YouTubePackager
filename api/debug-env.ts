type VercelRequest = {
  method?: string
}

type VercelResponse = {
  setHeader(name: string, value: string): void
  status(code: number): VercelResponse
  json(body: unknown): void
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET.' })
  }

  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  const value = env?.YOUTUBE_API_KEY

  return res.status(200).json({
    hasYouTubeApiKey: Boolean(value),
    keyLooksLikeGoogleApiKey: Boolean(value?.startsWith('AIza')),
    nodeEnv: env?.NODE_ENV ?? null,
    vercelEnv: env?.VERCEL_ENV ?? null,
  })
}
