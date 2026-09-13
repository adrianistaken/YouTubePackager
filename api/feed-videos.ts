import { handleApi, type ApiResponse } from './_lib/api'
import type { ApiRequest } from '../server/rateLimit'
export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleApi('feed', req, res)
}
