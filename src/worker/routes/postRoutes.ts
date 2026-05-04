import type { TodoResponse } from '../../shared/apiTypes'
import type { PostTreeResponse } from '../../shared/postTypes'
import { json } from '../utils/response'

export function handlePostsTree(): Response {
  const response: TodoResponse<PostTreeResponse> = {
    posts: [],
    tree: [],
    message: 'TODO: load posts tree from admin-index.json',
  }

  return json(response)
}
