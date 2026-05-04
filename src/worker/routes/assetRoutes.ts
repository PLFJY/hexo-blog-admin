import { json } from '../utils/response'

export function handleAssets(): Response {
  return json({
    assets: [],
    message: 'TODO: manage temporary draft image blobs in R2',
  })
}
