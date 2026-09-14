import { Body1, Button, Checkbox, Popover, PopoverSurface, PopoverTrigger, Spinner, Text, Title1, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, DocumentEditRegular, FolderRegular, EyeOffRegular, EyeRegular } from '@fluentui/react-icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { getJson, sendJson } from '../lib/apiClient'
import { getCachedAdminIndex, setCachedAdminIndex } from '../lib/indexCache'
import type { BatchPostsResponse, PostFile, PostTreeNode, PostTreeResponse, TogglePostPublishedResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const usePostStyles = makeStyles({
  treeGrid: { display: 'grid', gap: tokens.spacingVerticalM },
  syncingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorBrandForeground1,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    fontSize: tokens.fontSizeBase200,
  },
  folder: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: 0,
    ':hover': {
      borderTopColor: tokens.colorNeutralStroke1Hover,
      borderRightColor: tokens.colorNeutralStroke1Hover,
      borderBottomColor: tokens.colorNeutralStroke1Hover,
      borderLeftColor: tokens.colorNeutralStroke1Hover,
    },
  },
  folderHeader: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    minWidth: 0,
    '& > span': {
      overflowWrap: 'anywhere',
    },
  },
  childGrid: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    minWidth: 0,
    '@media (max-width: 480px)': {
      paddingLeft: tokens.spacingHorizontalS,
    },
  },
  postCard: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    '@media (max-width: 600px)': {
      gridTemplateColumns: 'auto minmax(0, 1fr)',
      alignItems: 'start',
    },
    ':hover': {
      borderTopColor: tokens.colorNeutralStroke1Hover,
      borderRightColor: tokens.colorNeutralStroke1Hover,
      borderBottomColor: tokens.colorNeutralStroke1Hover,
      borderLeftColor: tokens.colorNeutralStroke1Hover,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  postMeta: {
    display: 'grid',
    gap: '2px',
    minWidth: 0,
    '& > *': {
      overflowWrap: 'anywhere',
      whiteSpace: 'normal',
    },
  },
  selectionCheckbox: { marginTop: tokens.spacingVerticalXS },
  postActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    '@media (max-width: 600px)': {
      gridColumn: '2',
      justifyContent: 'flex-start',
      marginTop: tokens.spacingVerticalS,
    },
  },
  bulkBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': { color: tokens.colorNeutralForegroundOnBrand, backgroundColor: tokens.colorPaletteRedForeground1 },
    ':disabled': {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
      color: tokens.colorNeutralForegroundDisabled,
      borderTopColor: tokens.colorNeutralStrokeDisabled,
      borderRightColor: tokens.colorNeutralStrokeDisabled,
      borderBottomColor: tokens.colorNeutralStrokeDisabled,
      borderLeftColor: tokens.colorNeutralStrokeDisabled,
    },
  },
  publishButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteGreenBackground3,
    ':hover': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorPaletteGreenForeground1,
    },
    ':disabled': {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
      color: tokens.colorNeutralForegroundDisabled,
    },
  },
  popoverSurface: { display: 'grid', gap: tokens.spacingVerticalM, width: '320px' },
  confirmActions: { display: 'flex', justifyContent: 'flex-end', gap: tokens.spacingHorizontalS },
})

type PostsState =
  | { status: 'loading' }
  | { status: 'ready'; index: PostTreeResponse; openingRelativeId?: string; deletingRelativeId?: string; togglingRelativeId?: string; batchAction?: 'delete' | 'published'; selectedRelativeIds: string[]; message?: string; syncing?: boolean }
  | { status: 'error'; message: string }

type PostsLocationState = {
  message?: string
}

type TreeProps = {
  nodes: PostTreeNode[]
  postsById: Map<string, PostFile>
  onOpen: (post: PostFile) => void
  onDelete: (post: PostFile) => void
  onTogglePublished: (post: PostFile, published: boolean) => void
  selectedRelativeIds: ReadonlySet<string>
  onToggleSelect: (post: PostFile) => void
  batchBusy?: boolean
  openingRelativeId?: string
  deletingRelativeId?: string
  togglingRelativeId?: string
}

const isPostPublished = (post: PostFile) => (typeof post.published === 'boolean' ? post.published : post.metadata?.published !== false)

function PostTree({ nodes, postsById, onOpen, onDelete, onTogglePublished, selectedRelativeIds, onToggleSelect, batchBusy, openingRelativeId, deletingRelativeId, togglingRelativeId }: TreeProps) {
  const localStyles = usePostStyles()
  if (nodes.length === 0) return null
  return (
    <div className={localStyles.treeGrid}>
      {nodes.map((node) =>
        node.type === 'folder' ? (
          <section className={localStyles.folder} key={node.id}>
            <div className={localStyles.folderHeader}>
              <FolderRegular />
              <Text weight="semibold">{node.name}</Text>
              {node.sortPublishedAt ? <Text size={200}>{node.sortPublishedAt}</Text> : null}
            </div>
            <div className={localStyles.childGrid}>
              <PostTree nodes={node.children ?? []} postsById={postsById} onOpen={onOpen} onDelete={onDelete} onTogglePublished={onTogglePublished} selectedRelativeIds={selectedRelativeIds} onToggleSelect={onToggleSelect} batchBusy={batchBusy} openingRelativeId={openingRelativeId} deletingRelativeId={deletingRelativeId} togglingRelativeId={togglingRelativeId} />
            </div>
          </section>
        ) : (() => {
          const post = (node.postRef ? postsById.get(node.postRef) : undefined) ?? node.post
          return post ? (
          <PostCard
            key={node.id}
            post={post}
            onOpen={onOpen}
            onDelete={onDelete}
            onTogglePublished={onTogglePublished}
            selected={selectedRelativeIds.has(post.relativeId)}
            onToggleSelect={() => onToggleSelect(post)}
            batchBusy={batchBusy}
            opening={openingRelativeId === post.relativeId}
            deleting={deletingRelativeId === post.relativeId}
            toggling={togglingRelativeId === post.relativeId}
          />
          ) : null
        })(),
      )}
    </div>
  )
}

function PostCard({
  post,
  opening,
  deleting,
  toggling,
  onOpen,
  onDelete,
  onTogglePublished,
  selected,
  onToggleSelect,
  batchBusy,
}: {
  post: PostFile
  opening?: boolean
  deleting?: boolean
  toggling?: boolean
  onOpen: (post: PostFile) => void
  onDelete: (post: PostFile) => void
  onTogglePublished: (post: PostFile, published: boolean) => void
  selected: boolean
  onToggleSelect: () => void
  batchBusy?: boolean
}) {
  const styles = usePostStyles()
  const { t } = useTranslation()
  const published = isPostPublished(post)
  return (
    <article className={styles.postCard}>
      <Checkbox className={styles.selectionCheckbox} checked={selected} onChange={onToggleSelect} disabled={batchBusy} aria-label={post.title} />
      <span className={styles.postMeta}>
        <Text weight="semibold" truncate>{post.title}</Text>
        <Text size={200} truncate>{post.relativeId}</Text>
        <Text size={200}>{post.metadata?.publishedAt ?? post.publishedAt ?? post.date ?? '-'} · {published ? t('posts.publishedStatus') : t('posts.unpublishedStatus')}</Text>
      </span>
      <span className={styles.postActions}>
        <Button appearance="primary" icon={opening ? <Spinner size="tiny" /> : <DocumentEditRegular />} disabled={batchBusy || opening || deleting || toggling} onClick={() => onOpen(post)}>{t('actions.edit')}</Button>
        <TogglePublishedPopover
          disabled={batchBusy || opening || deleting || toggling}
          busy={toggling}
          published={published}
          onConfirm={() => onTogglePublished(post, !published)}
        />
        <DeletePostPopover disabled={batchBusy || opening || deleting || toggling} busy={deleting} onConfirm={() => onDelete(post)} />
      </span>
    </article>
  )
}

export function PostsPage() {
  const styles = usePageStyles()
  const localStyles = usePostStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<PostsState>({ status: 'loading' })
  const locationState = location.state as PostsLocationState | null
  const postsById = useMemo(
    () => new Map((state.status === 'ready' ? state.index.posts : []).map((post) => [post.relativeId, post])),
    [state],
  )
  const selectedRelativeIds = new Set(state.status === 'ready' ? state.selectedRelativeIds : [])

  const load = () => {
    const cached = getCachedAdminIndex()
    if (cached) {
      setState((current) => ({
        status: 'ready',
        index: cached,
        selectedRelativeIds: current.status === 'ready' ? current.selectedRelativeIds : [],
        message: current.status === 'ready' ? current.message : locationState?.message,
        syncing: true,
      }))
    } else {
      setState({ status: 'loading' })
    }

    void getJson<PostTreeResponse>('/posts/tree')
      .then((index) => {
        setCachedAdminIndex(index)
        setState((current) => ({
          status: 'ready',
          index,
          openingRelativeId: current.status === 'ready' ? current.openingRelativeId : undefined,
          deletingRelativeId: current.status === 'ready' ? current.deletingRelativeId : undefined,
          togglingRelativeId: current.status === 'ready' ? current.togglingRelativeId : undefined,
          selectedRelativeIds: current.status === 'ready' ? current.selectedRelativeIds.filter((id) => index.posts.some((post) => post.relativeId === id)) : [],
          message: current.status === 'ready' ? current.message : locationState?.message,
          syncing: false,
        }))
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setState((current) => (current.status === 'ready' ? { ...current, syncing: false, message } : { status: 'error', message }))
      })
  }

  const openPost = (post: PostFile) => {
    if (state.status !== 'ready') return
    setState({ ...state, openingRelativeId: post.relativeId, message: undefined })
    navigate(`/posts/edit?relativeId=${encodeURIComponent(post.relativeId)}`)
  }

  const deletePost = (post: PostFile) => {
    if (state.status !== 'ready') return
    setState({ ...state, deletingRelativeId: post.relativeId })
    void sendJson<{ commitSha: string }>('/posts/delete', 'POST', { relativeId: post.relativeId })
      .then((response) => setState({ ...state, deletingRelativeId: undefined, message: t('posts.deleteSuccess', { commitSha: response.commitSha }) }))
      .catch((error: unknown) => setState({ ...state, deletingRelativeId: undefined, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const togglePostSelection = (post: PostFile) => {
    if (state.status !== 'ready' || state.batchAction) return
    const selected = new Set(state.selectedRelativeIds)
    if (selected.has(post.relativeId)) selected.delete(post.relativeId)
    else selected.add(post.relativeId)
    setState({ ...state, selectedRelativeIds: Array.from(selected) })
  }

  const selectAllPosts = () => {
    if (state.status !== 'ready' || state.batchAction) return
    const allSelected = state.selectedRelativeIds.length === state.index.posts.length
    setState({ ...state, selectedRelativeIds: allSelected ? [] : state.index.posts.map((post) => post.relativeId) })
  }

  const patchPostPublished = (nodes: PostTreeNode[], relativeId: string, published: boolean): PostTreeNode[] =>
    nodes.map((node) =>
      node.type === 'folder'
        ? { ...node, children: patchPostPublished(node.children ?? [], relativeId, published) }
        : (node.postRef === relativeId || node.post?.relativeId === relativeId) && node.post
          ? { ...node, post: { ...node.post, published, metadata: { ...node.post.metadata, published } } }
          : node,
    )

  const patchPostPublishedMany = (nodes: PostTreeNode[], relativeIds: ReadonlySet<string>, published: boolean): PostTreeNode[] =>
    nodes.map((node) =>
      node.type === 'folder'
        ? { ...node, children: patchPostPublishedMany(node.children ?? [], relativeIds, published) }
        : (relativeIds.has(node.postRef ?? node.post?.relativeId ?? '') && node.post)
          ? { ...node, post: { ...node.post, published, metadata: { ...node.post.metadata, published } } }
          : node,
    )

  const removePostsFromTree = (nodes: PostTreeNode[], relativeIds: ReadonlySet<string>): PostTreeNode[] =>
    nodes
      .map((node) => node.type === 'folder' ? { ...node, children: removePostsFromTree(node.children ?? [], relativeIds) } : node)
      .filter((node) => node.type === 'post' ? !relativeIds.has(node.postRef ?? node.post?.relativeId ?? '') : (node.children?.length ?? 0) > 0)

  const batchDeletePosts = () => {
    if (state.status !== 'ready' || state.selectedRelativeIds.length === 0 || state.batchAction) return
    if (!window.confirm(t('posts.confirmBatchDeleteDescription', { count: state.selectedRelativeIds.length }))) return
    const ids = state.selectedRelativeIds
    setState({ ...state, batchAction: 'delete', message: undefined })
    void sendJson<BatchPostsResponse>('/posts/batch', 'POST', { relativeIds: ids, action: 'delete' })
      .then((response) => {
        const removed = new Set(response.relativeIds)
        const nextIndex = {
          ...state.index,
          posts: state.index.posts.filter((post) => !removed.has(post.relativeId)),
          tree: removePostsFromTree(state.index.tree, removed),
        }
        setCachedAdminIndex(nextIndex)
        setState({ ...state, index: nextIndex, selectedRelativeIds: [], batchAction: undefined, message: t('posts.batchDeleteSuccess', { count: removed.size, commitSha: response.commitSha }) })
      })
      .catch((error: unknown) => setState({ ...state, batchAction: undefined, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const batchTogglePublished = (published: boolean) => {
    if (state.status !== 'ready' || state.selectedRelativeIds.length === 0 || state.batchAction) return
    if (!window.confirm(t(published ? 'posts.confirmBatchPublishDescription' : 'posts.confirmBatchUnpublishDescription', { count: state.selectedRelativeIds.length }))) return
    const ids = state.selectedRelativeIds
    setState({ ...state, batchAction: 'published', message: undefined })
    void sendJson<BatchPostsResponse>('/posts/batch', 'POST', { relativeIds: ids, action: 'published', published })
      .then((response) => {
        const selected = new Set(response.relativeIds)
        const nextIndex = {
          ...state.index,
          posts: state.index.posts.map((post) => selected.has(post.relativeId) ? { ...post, published, metadata: { ...post.metadata, published } } : post),
          tree: patchPostPublishedMany(state.index.tree, selected, published),
        }
        setCachedAdminIndex(nextIndex)
        setState({ ...state, index: nextIndex, selectedRelativeIds: [], batchAction: undefined, message: t('posts.batchPublishedToggleSuccess', { count: selected.size, status: published ? t('posts.publishedStatus') : t('posts.unpublishedStatus'), commitSha: response.commitSha }) })
      })
      .catch((error: unknown) => setState({ ...state, batchAction: undefined, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const togglePostPublished = (post: PostFile, published: boolean) => {
    if (state.status !== 'ready') return
    setState({ ...state, togglingRelativeId: post.relativeId, message: undefined })
    void sendJson<TogglePostPublishedResponse>('/posts/published', 'POST', { relativeId: post.relativeId, published })
      .then((response) => {
        const nextIndex = {
          ...state.index,
          posts: state.index.posts.map((item) =>
            item.relativeId === response.relativeId
              ? { ...item, published: response.published, metadata: { ...item.metadata, published: response.published } }
              : item,
          ),
          tree: patchPostPublished(state.index.tree, response.relativeId, response.published),
        }
        setCachedAdminIndex(nextIndex)
        setState({
          ...state,
          index: nextIndex,
          togglingRelativeId: undefined,
          message: t('posts.publishedToggleSuccess', { status: response.published ? t('posts.publishedStatus') : t('posts.unpublishedStatus'), commitSha: response.commitSha }),
        })
      })
      .catch((error: unknown) => setState({ ...state, togglingRelativeId: undefined, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  useEffect(() => {
    queueMicrotask(load)
  }, [])

  useEffect(() => {
    if (!locationState) return
    if (locationState?.message) {
      queueMicrotask(() => {
        setState((current) => (current.status === 'ready' ? { ...current, message: locationState.message } : current))
      })
    }
    navigate('/posts', { replace: true, state: null })
  }, [locationState, navigate])
  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
          <Title1>{t('posts.title')}</Title1>
          {state.status === 'ready' && state.syncing && (
            <div className={localStyles.syncingIndicator}>
              <Spinner size="tiny" />
              <Text size={200}>正在拉取最新数据...</Text>
            </div>
          )}
        </div>
        <Body1>{t('posts.description')}</Body1>
      </header>
      {state.index.posts.length === 0 ? (
        <EmptyState title={t('posts.emptyTitle')} description={t('posts.emptyDescription')} />
      ) : (
        <section className={styles.card}>
          <Title3>{t('posts.loaded')}: {state.index.posts.length}</Title3>
          {state.index.generatedAt ? <Text>{t('posts.generatedAt')}: {state.index.generatedAt}</Text> : null}
          {state.message ? <section className={localStyles.folder}><Text>{state.message}</Text></section> : null}
          <div className={localStyles.bulkBar}>
            <Checkbox checked={state.selectedRelativeIds.length === state.index.posts.length} onChange={selectAllPosts} label={t('posts.selectAll')} />
            {state.selectedRelativeIds.length > 0 ? <Text>{t('posts.selectedCount', { count: state.selectedRelativeIds.length })}</Text> : null}
            <Button appearance="primary" className={localStyles.dangerPrimaryButton} disabled={state.selectedRelativeIds.length === 0 || Boolean(state.batchAction)} icon={state.batchAction === 'delete' ? <Spinner size="tiny" /> : <DeleteRegular />} onClick={batchDeletePosts}>{t('posts.deleteSelected')}</Button>
            <Button disabled={state.selectedRelativeIds.length === 0 || Boolean(state.batchAction)} icon={state.batchAction === 'published' ? <Spinner size="tiny" /> : <EyeRegular />} onClick={() => batchTogglePublished(true)}>{t('posts.publishSelected')}</Button>
            <Button disabled={state.selectedRelativeIds.length === 0 || Boolean(state.batchAction)} icon={state.batchAction === 'published' ? <Spinner size="tiny" /> : <EyeOffRegular />} onClick={() => batchTogglePublished(false)}>{t('posts.unpublishSelected')}</Button>
          </div>
          <PostTree
            nodes={state.index.tree}
            postsById={postsById}
            onOpen={openPost}
            onDelete={deletePost}
            onTogglePublished={togglePostPublished}
            selectedRelativeIds={selectedRelativeIds}
            onToggleSelect={togglePostSelection}
            batchBusy={Boolean(state.batchAction)}
            openingRelativeId={state.openingRelativeId}
            deletingRelativeId={state.deletingRelativeId}
            togglingRelativeId={state.togglingRelativeId}
          />
        </section>
      )}
    </section>
  )
}

function TogglePublishedPopover({
  disabled,
  busy,
  published,
  onConfirm,
}: {
  disabled?: boolean
  busy?: boolean
  published: boolean
  onConfirm: () => void
}) {
  const styles = usePostStyles()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const icon = busy ? <Spinner size="tiny" /> : published ? <EyeOffRegular /> : <EyeRegular />
  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance={published ? 'secondary' : 'primary'}
          className={published ? undefined : styles.publishButton}
          icon={icon}
          disabled={disabled}
        >
          {published ? t('posts.unpublishPost') : t('posts.publishPost')}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.popoverSurface}>
        <Text weight="semibold">{published ? t('posts.confirmUnpublishTitle') : t('posts.confirmPublishTitle')}</Text>
        <Text>{published ? t('posts.confirmUnpublishDescription') : t('posts.confirmPublishDescription')}</Text>
        <div className={styles.confirmActions}>
          <Button onClick={() => setOpen(false)}>{t('actions.cancel')}</Button>
          <Button
            appearance={published ? 'secondary' : 'primary'}
            className={published ? undefined : styles.publishButton}
            icon={published ? <EyeOffRegular /> : <EyeRegular />}
            onClick={() => { setOpen(false); onConfirm() }}
          >
            {published ? t('posts.unpublishPost') : t('posts.publishPost')}
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}

function DeletePostPopover({ disabled, busy, onConfirm }: { disabled?: boolean; busy?: boolean; onConfirm: () => void }) {
  const styles = usePostStyles()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={styles.dangerPrimaryButton} icon={busy ? <Spinner size="tiny" /> : <DeleteRegular />} disabled={disabled}>{t('actions.delete')}</Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.popoverSurface}>
        <Text weight="semibold">{t('posts.confirmDeleteTitle')}</Text>
        <Text>{t('posts.confirmDeleteDescription')}</Text>
        <div className={styles.confirmActions}>
          <Button onClick={() => setOpen(false)}>{t('actions.cancel')}</Button>
          <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />} onClick={() => { setOpen(false); onConfirm() }}>{t('actions.delete')}</Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}
