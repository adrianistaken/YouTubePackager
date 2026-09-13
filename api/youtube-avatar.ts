import { handleApi, type ApiResponse } from './_lib/api.js'
import type { ApiRequest } from './_lib/rateLimit.js'
export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleApi('avatar', req, res)
}
