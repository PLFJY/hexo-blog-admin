import { Body1, Button, Text, Title1, Title3 } from '@fluentui/react-components'
import { DocumentEditRegular, OpenRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { PostTreePlaceholder } from '../features/posts/PostTreePlaceholder'
import { getJson, sendJson } from '../lib/apiClient'
import type { DraftRecord } from '../shared/draftTypes'
import type { PostContentResponse, PostFile, PostTreeNode, PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

type PostsState =
  | { status: 'loading' }
  | { status: 'ready'; index: PostTreeResponse; selected?: PostContentResponse; message?: string }
  | { status: 'error'; message: string }

type TreeProps = {
  nodes: PostTreeNode[]
  onOpen: (post: PostFile) => void
}

function PostTree({ nodes, onOpen }: TreeProps) {
  if (nodes.length === 0) return null

  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          {node.type === 'folder' ? (
            <>
              <Text weight="semibold">{node.name}</Text>
              <PostTree nodes={node.children ?? []} onOpen={onOpen} />
            </>
          ) : (
            <Button appearance="subtle" icon={<OpenRegular />} onClick={() => node.post && onOpen(node.post)}>
              {node.post?.title ?? node.name}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function PostsPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<PostsState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<PostTreeResponse>('/api/posts/tree')
      .then((index) => setState({ status: 'ready', index }))
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const openPost = (post: PostFile) => {
    if (state.status !== 'ready') return
    void getJson<PostContentResponse>(`/api/posts/content?relativeId=${encodeURIComponent(post.relativeId)}`)
      .then((selected) => setState({ ...state, selected, message: undefined }))
      .catch((error: unknown) =>
        setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const createDraft = () => {
    if (state.status !== 'ready' || !state.selected) return
    const selected = state.selected
    void sendJson<DraftRecord>('/api/drafts', 'POST', {
      relativeId: selected.post.relativeId,
      title: selected.post.title,
      markdown: selected.markdown,
    }).then(() => setState({ ...state, message: t('drafts.saved') }))
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
          <PostTree nodes={state.index.tree} onOpen={openPost} />
        </section>
      )}
      {state.message ? <Text>{state.message}</Text> : null}
      {state.selected ? (
        <section className={styles.card}>
          <div className={styles.row}>
            <Title3>{state.selected.post.title}</Title3>
            <Button appearance="primary" icon={<DocumentEditRegular />} onClick={createDraft}>
              {t('posts.createDraft')}
            </Button>
          </div>
          <Text>{state.selected.post.relativeId}</Text>
          <pre className={styles.codeBlock}>
            <code>{state.selected.markdown}</code>
          </pre>
        </section>
      ) : null}
      <PostTreePlaceholder />
    </section>
  )
}
