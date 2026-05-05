import { makeStyles, tokens } from '@fluentui/react-components'
import { useEffect, useState } from 'react'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { buildApiUrl } from '../lib/apiClient'
import type { DraftAsset } from '../shared/assetTypes'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
    width: '100%',
    '@media (max-width: 960px)': {
      gridTemplateColumns: '1fr',
    },
  },
  previewColumn: {
    paddingTop: '36px',
    '@media (max-width: 960px)': {
      paddingTop: 0,
    },
  },
})

type ArticleMarkdownWorkspaceProps = {
  markdown: string
  onChange: (markdown: string) => void
  resolveResourceUrl?: (src: string) => string
  assets?: DraftAsset[]
  onAssetObjectUrlsChange?: (urls: Record<string, string>) => void
  insertRequest?: { id: number; text: string }
  onInsertConsumed?: (id: number) => void
}

export function ArticleMarkdownWorkspace({
  markdown,
  onChange,
  resolveResourceUrl,
  assets = [],
  onAssetObjectUrlsChange,
  insertRequest,
  onInsertConsumed,
}: ArticleMarkdownWorkspaceProps) {
  const styles = useStyles()
  const [previewScrollRatio, setPreviewScrollRatio] = useState(0)

  useEffect(() => {
    if (!onAssetObjectUrlsChange || assets.length === 0) {
      return undefined
    }

    let disposed = false
    const objectUrls: Record<string, string> = {}
    void Promise.all(
      assets.map(async (asset) => {
        const response = await fetch(buildApiUrl(`/assets/blob?key=${encodeURIComponent(asset.key)}`), {
          credentials: 'include',
        })
        if (!response.ok) return
        const blob = await response.blob()
        if (disposed) return
        objectUrls[asset.key] = URL.createObjectURL(blob)
      }),
    ).then(() => {
      if (!disposed) onAssetObjectUrlsChange(objectUrls)
    })

    return () => {
      disposed = true
      for (const url of Object.values(objectUrls)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [assets])

  return (
    <div className={styles.root}>
      <MarkdownEditor
        value={markdown}
        onChange={onChange}
        onScrollRatioChange={setPreviewScrollRatio}
        insertRequest={insertRequest}
        onInsertConsumed={onInsertConsumed}
      />
      <div className={styles.previewColumn}>
        <MarkdownPreview markdown={markdown} resolveResourceUrl={resolveResourceUrl} scrollRatio={previewScrollRatio} />
      </div>
    </div>
  )
}
