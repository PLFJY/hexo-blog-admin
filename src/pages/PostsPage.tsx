import { Body1, Button, Field, Text, Title1, Title3 } from '@fluentui/react-components'
import { DocumentEditRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { ArticleMarkdownWorkspace } from '../components/ArticleMarkdownWorkspace'
import { MarkdownAssetPanel } from '../components/MarkdownAssetPanel'
import { getJson, sendJson } from '../lib/apiClient'
import { resolveMarkdownResourceUrl } from '../lib/markdownResource'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftRecord } from '../shared/draftTypes'
import { extractFrontMatterTitle } from '../shared/frontMatter'
import type { DraftAsset } from '../shared/assetTypes'
import type { PostContentResponse, PostFile, PostTreeNode, PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

type PostsState =
  | { status: 'loading' }
  | { status: 'ready'; index: PostTreeResponse; selected?: PostContentResponse; editingMarkdown?: string; assets: DraftAsset[]; publicConfig?: PublicConfigResponse; message?: string }
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
            <Button appearance="subtle" icon={<DocumentEditRegular />} onClick={() => node.post && onOpen(node.post)}>
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
  const [assetObjectUrls, setAssetObjectUrls] = useState<Record<string, string>>({})

  const load = () => {
    setState({ status: 'loading' })
    void getJson<PostTreeResponse>('/posts/tree')
      .then((index) => {
        setState({ status: 'ready', index, assets: [] })
        void getJson<PublicConfigResponse>('/config/public').then((publicConfig) =>
          setState((current) => (current.status === 'ready' ? { ...current, publicConfig } : current)),
        )
      })
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const openPost = (post: PostFile) => {
    if (state.status !== 'ready') return
    void getJson<PostContentResponse>(`/posts/content?relativeId=${encodeURIComponent(post.relativeId)}`)
      .then((selected) => setState({ ...state, selected, editingMarkdown: selected.markdown, assets: [], message: undefined }))
      .catch((error: unknown) =>
        setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const saveDraft = () => {
    if (state.status !== 'ready' || !state.selected) return
    const selected = state.selected
    void sendJson<DraftRecord>('/drafts', 'POST', {
      relativeId: selected.post.relativeId,
      title: extractFrontMatterTitle(state.editingMarkdown ?? selected.markdown),
      markdown: state.editingMarkdown ?? selected.markdown,
    }).then((draft) => setState({ ...state, message: t('drafts.saved'), assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })) }))
  }

  const updateMarkdown = (value: string) => {
    if (state.status !== 'ready') return
    setState({ ...state, editingMarkdown: value })
  }

  const insertMarkdown = (markdown: string) => {
    if (state.status !== 'ready') return
    const current = state.editingMarkdown ?? state.selected?.markdown ?? ''
    setState({ ...state, editingMarkdown: `${current}${current.endsWith('\n') ? '' : '\n'}${markdown}\n` })
  }

  const resolveResourceUrl = (src: string) => {
    if (state.status !== 'ready' || !state.selected) return src
    return resolveMarkdownResourceUrl({
      src,
      relativeId: state.selected.post.relativeId,
      publicConfig: state.publicConfig,
      assets: state.assets,
      assetObjectUrls,
    })
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
            <Button appearance="primary" icon={<SaveRegular />} onClick={saveDraft}>
              {t('posts.createDraft')}
            </Button>
          </div>
          <Text>{state.selected.post.relativeId}</Text>
          <MarkdownAssetPanel
            relativeId={state.selected.post.relativeId}
            draftId={state.assets[0]?.draftId}
            assets={state.assets}
            onAssetsChange={(assets) => setState({ ...state, assets })}
            onInsertMarkdown={insertMarkdown}
          />
          <Field label={t('posts.editor')}>
            <ArticleMarkdownWorkspace
              markdown={state.editingMarkdown ?? state.selected.markdown}
              onChange={updateMarkdown}
              resolveResourceUrl={resolveResourceUrl}
              assets={state.assets}
              onAssetObjectUrlsChange={setAssetObjectUrls}
            />
          </Field>
        </section>
      ) : null}
    </section>
  )
}
