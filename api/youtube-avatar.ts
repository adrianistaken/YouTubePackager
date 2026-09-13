import { handleApi, type ApiResponse } from '../server/api'
import type { ApiRequest } from '../server/rateLimit'
export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleApi('avatar', req, res)
}
