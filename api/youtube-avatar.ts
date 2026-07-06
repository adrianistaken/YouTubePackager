import { resolveYouTubeAvatar } from '../server/youtubeAvatar'

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
