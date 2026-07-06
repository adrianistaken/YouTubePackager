import { resolveCachedPopularFeedVideos } from '../server/youtubeFeed'

type VercelRequest = {
  method?: string
  query: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  setHeader(name: string, value: string): void
  status(code: number): VercelResponse
  json(body: unknown): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')

  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET.' })
  }

  const regionParam = req.query.region
  const regionCode = Array.isArray(regionParam) ? regionParam[0] : regionParam

  try {
    return res.status(200).json({ videos: await resolveCachedPopularFeedVideos(regionCode ?? 'US') })
  } catch (error) {
    return res.status(503).json({
      error: error instanceof Error ? error.message : 'Live feed videos are unavailable.',
    })
  }
}
