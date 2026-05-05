import { Body1, Button, Popover, PopoverSurface, PopoverTrigger, Spinner, Text, Title1, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, DocumentEditRegular, FolderRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { getJson, sendJson } from '../lib/apiClient'
import type { PostFile, PostTreeNode, PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const usePostStyles = makeStyles({
  treeGrid: { display: 'grid', gap: tokens.spacingVerticalM },
  folder: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  folderHeader: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  childGrid: { display: 'grid', gap: tokens.spacingVerticalS, paddingLeft: tokens.spacingHorizontalL },
  postCard: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  postMeta: { display: 'grid', gap: '2px', minWidth: 0 },
  postActions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: tokens.spacingHorizontalS },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': { color: tokens.colorNeutralForegroundOnBrand, backgroundColor: tokens.colorPaletteRedForeground1 },
    ':disabled': {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
      color: tokens.colorNeutralForegroundDisabled,
      borderColor: tokens.colorNeutralStrokeDisabled,
    },
  },
  popoverSurface: { display: 'grid', gap: tokens.spacingVerticalM, width: '320px' },
  confirmActions: { display: 'flex', justifyContent: 'flex-end', gap: tokens.spacingHorizontalS },
})

type PostsState =
  | { status: 'loading' }
  | { status: 'ready'; index: PostTreeResponse; openingRelativeId?: string; deletingRelativeId?: string; message?: string }
  | { status: 'error'; message: string }

type TreeProps = {
  nodes: PostTreeNode[]
  onOpen: (post: PostFile) => void
  onDelete: (post: PostFile) => void
  openingRelativeId?: string
  deletingRelativeId?: string
}

function PostTree({ nodes, onOpen, onDelete, openingRelativeId, deletingRelativeId }: TreeProps) {
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
              <PostTree nodes={node.children ?? []} onOpen={onOpen} onDelete={onDelete} openingRelativeId={openingRelativeId} deletingRelativeId={deletingRelativeId} />
            </div>
          </section>
        ) : node.post ? (
          <PostCard key={node.id} post={node.post} onOpen={onOpen} onDelete={onDelete} opening={openingRelativeId === node.post.relativeId} deleting={deletingRelativeId === node.post.relativeId} />
        ) : null,
      )}
    </div>
  )
}

function PostCard({ post, opening, deleting, onOpen, onDelete }: { post: PostFile; opening?: boolean; deleting?: boolean; onOpen: (post: PostFile) => void; onDelete: (post: PostFile) => void }) {
  const styles = usePostStyles()
  return (
    <article className={styles.postCard}>
      <span className={styles.postMeta}>
        <Text weight="semibold" truncate>{post.title}</Text>
        <Text size={200} truncate>{post.relativeId}</Text>
        <Text size={200}>{post.metadata?.publishedAt ?? post.publishedAt ?? post.date ?? '-'}</Text>
      </span>
      <span className={styles.postActions}>
        <Button appearance="primary" icon={opening ? <Spinner size="tiny" /> : <DocumentEditRegular />} disabled={opening || deleting} onClick={() => onOpen(post)}>{t('actions.edit')}</Button>
        <DeletePostPopover disabled={opening || deleting} busy={deleting} onConfirm={() => onDelete(post)} />
      </span>
    </article>
  )
}

export function PostsPage() {
  const styles = usePageStyles()
  const localStyles = usePostStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [state, setState] = useState<PostsState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<PostTreeResponse>('/posts/tree')
      .then((index) => setState({ status: 'ready', index }))
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
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

  useEffect(load, [])
  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('posts.title')}</Title1>
        <Body1>{t('posts.description')}</Body1>
      </header>
      {state.index.posts.length === 0 ? (
        <EmptyState title={t('posts.emptyTitle')} description={t('posts.emptyDescription')} />
      ) : (
        <section className={styles.card}>
          <Title3>{t('posts.loaded')}: {state.index.posts.length}</Title3>
          {state.index.generatedAt ? <Text>{t('posts.generatedAt')}: {state.index.generatedAt}</Text> : null}
          {state.message ? <section className={localStyles.folder}><Text>{state.message}</Text></section> : null}
          <PostTree nodes={state.index.tree} onOpen={openPost} onDelete={deletePost} openingRelativeId={state.openingRelativeId} deletingRelativeId={state.deletingRelativeId} />
        </section>
      )}
    </section>
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
