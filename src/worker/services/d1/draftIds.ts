import { createDraftId, isValidRelativeId, normalizeRelativeId } from '../../../features/posts/relativeId'

export { createDraftId, isValidRelativeId, normalizeRelativeId }

const emptyDraftId = '__empty-draft-id__'

export const resolveDraftId = (id: string) => (id === emptyDraftId ? '' : id)

export const visibleDraftId = (id: string) => id || emptyDraftId
