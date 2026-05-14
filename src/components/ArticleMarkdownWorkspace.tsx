import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import type { EditorView } from '@uiw/react-codemirror'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownEditor } from './MarkdownEditor'
import type { PreviewSyncPosition } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { buildApiUrl } from '../lib/apiClient'
import type { ResolvedMarkdownResourceUrl } from '../lib/markdownResource'
import type { DraftAsset } from '../shared/assetTypes'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    '@media (max-width: 960px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  column: {
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  previewColumn: {
    paddingTop: `calc(32px + ${tokens.spacingVerticalXS})`,
    '@media (max-width: 960px)': {
      paddingTop: 0,
    },
  },
})

type PreviewScrollMap = {
  lines: number[]
  editorYs: number[]
  previewYs: number[]
  editorMaxScrollTop: number
  previewMaxScrollTop: number
}

type ScrollSource = 'editor' | 'preview' | null

type SourceAnchor = {
  line: number
  editorY: number
  previewY: number
}

const SCROLL_SOURCE_RELEASE_DELAY = 150
const CURSOR_REVEAL_RATIO = 0.18

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const mapScrollTop = (x: number, from: number[], to: number[]) => {
  if (from.length === 0 || to.length === 0) return 0
  if (from.length !== to.length) return 0
  if (x <= from[0]) return to[0]
  if (x >= from[from.length - 1]) return to[to.length - 1]

  let low = 0
  let high = from.length - 1
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (from[mid] > x) high = mid
    else low = mid + 1
  }

  const index = low
  const fromStart = from[index - 1]
  const fromEnd = from[index]
  const toStart = to[index - 1]
  const toEnd = to[index]
  if (fromEnd === fromStart) return toStart

  const progress = (x - fromStart) / (fromEnd - fromStart)
  return toStart + progress * (toEnd - toStart)
}

const mapByGlobalRatio = (sourceScrollTop: number, sourceMax: number, targetMax: number) => {
  if (sourceMax <= 0) return 0
  return targetMax * (sourceScrollTop / sourceMax)
}

const getPreviewY = (previewRoot: HTMLElement, element: HTMLElement) => {
  const rootRect = previewRoot.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  return elementRect.top - rootRect.top + previewRoot.scrollTop
}

const getEditorYForLine = (view: EditorView, lineNumber: number) => {
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) return undefined
  const line = view.state.doc.line(lineNumber)
  const block = view.lineBlockAt(line.from)
  return block.top
}

const buildScrollMap = (view: EditorView, previewRoot: HTMLElement): PreviewScrollMap => {
  const editorMaxScrollTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)
  const previewMaxScrollTop = Math.max(0, previewRoot.scrollHeight - previewRoot.clientHeight)
  const anchors: SourceAnchor[] = [{ line: 1, editorY: 0, previewY: 0 }]
  const seenLines = new Set<number>([1])
  const previewAnchors = Array.from(previewRoot.querySelectorAll<HTMLElement>('[data-source-line]'))
    .map((element) => ({
      element,
      line: Number(element.dataset.sourceLine),
    }))
    .filter((anchor) => Number.isFinite(anchor.line) && anchor.line >= 1)
    .sort((a, b) => a.line - b.line)

  for (const anchor of previewAnchors) {
    const line = Math.min(view.state.doc.lines, Math.max(1, Math.floor(anchor.line)))
    if (seenLines.has(line)) continue

    const editorY = getEditorYForLine(view, line)
    if (editorY == null || !Number.isFinite(editorY)) continue

    const previewY = getPreviewY(previewRoot, anchor.element)
    if (!Number.isFinite(previewY)) continue

    seenLines.add(line)
    anchors.push({
      line,
      editorY: clamp(editorY, 0, editorMaxScrollTop),
      previewY: clamp(previewY, 0, previewMaxScrollTop),
    })
  }

  anchors.sort((a, b) => a.line - b.line)

  const normalized: SourceAnchor[] = []
  for (const anchor of anchors) {
    const previous = normalized[normalized.length - 1]
    if (previous && (anchor.editorY < previous.editorY || anchor.previewY < previous.previewY)) continue
    normalized.push(anchor)
  }

  const bottomAnchor = {
    line: view.state.doc.lines,
    editorY: editorMaxScrollTop,
    previewY: previewMaxScrollTop,
  }
  const last = normalized[normalized.length - 1]
  if (!last) normalized.push(bottomAnchor)
  else if (last.line === bottomAnchor.line) normalized[normalized.length - 1] = bottomAnchor
  else normalized.push(bottomAnchor)

  return {
    lines: normalized.map((anchor) => anchor.line),
    editorYs: normalized.map((anchor) => anchor.editorY),
    previewYs: normalized.map((anchor) => anchor.previewY),
    editorMaxScrollTop,
    previewMaxScrollTop,
  }
}

const mapSourceLineToPreviewY = (line: number, scrollMap: PreviewScrollMap) => {
  const { lines, previewYs } = scrollMap
  if (lines.length === 0 || lines.length !== previewYs.length) return undefined
  if (line <= lines[0]) return previewYs[0]
  if (line >= lines[lines.length - 1]) return previewYs[previewYs.length - 1]

  let low = 0
  let high = lines.length - 1
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (lines[mid] > line) high = mid
    else low = mid + 1
  }

  const index = low
  const lineStart = lines[index - 1]
  const lineEnd = lines[index]
  const yStart = previewYs[index - 1]
  const yEnd = previewYs[index]
  if (lineEnd === lineStart) return yStart

  const progress = (line - lineStart) / (lineEnd - lineStart)
  return yStart + progress * (yEnd - yStart)
}

type ArticleMarkdownWorkspaceProps = {
  markdown: string
  onChange: (markdown: string) => void
  resolveResourceUrl?: (src: string) => ResolvedMarkdownResourceUrl
  assets?: DraftAsset[]
  onAssetObjectUrlsChange?: (urls: Record<string, string>) => void
  insertRequest?: { id: number; text: string }
  onInsertConsumed?: (id: number) => void
  onPasteImages?: (files: File[]) => void
  documentKey?: string
}

export function ArticleMarkdownWorkspace({
  markdown,
  onChange,
  resolveResourceUrl,
  assets = [],
  onAssetObjectUrlsChange,
  insertRequest,
  onInsertConsumed,
  onPasteImages,
  documentKey,
}: ArticleMarkdownWorkspaceProps) {
  const styles = useStyles()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [previewRoot, setPreviewRoot] = useState<HTMLDivElement | null>(null)
  const onAssetObjectUrlsChangeRef = useRef(onAssetObjectUrlsChange)
  const editorViewRef = useRef<EditorView | null>(null)
  const previewRootRef = useRef<HTMLDivElement | null>(null)
  const scrollMapRef = useRef<PreviewScrollMap | undefined>(undefined)
  const scrollMapDirtyRef = useRef(true)
  const activeScrollSourceRef = useRef<ScrollSource>(null)
  const suppressEditorScrollRef = useRef(false)
  const suppressPreviewScrollRef = useRef(false)
  const scrollSourceReleaseTimerRef = useRef<number | undefined>(undefined)
  const editorToPreviewFrameRef = useRef<number | undefined>(undefined)
  const previewToEditorFrameRef = useRef<number | undefined>(undefined)
  const cursorSyncFrameRef = useRef<number | undefined>(undefined)
  const latestCursorLineRef = useRef(1)
  const pendingCursorLineRef = useRef<number | undefined>(1)

  const invalidateScrollMap = useCallback(() => {
    scrollMapDirtyRef.current = true
  }, [])

  const getOrBuildScrollMap = useCallback(() => {
    const view = editorViewRef.current
    const root = previewRootRef.current
    if (!view || !root) return undefined
    if (!scrollMapDirtyRef.current && scrollMapRef.current) return scrollMapRef.current

    const nextMap = buildScrollMap(view, root)
    scrollMapRef.current = nextMap
    scrollMapDirtyRef.current = false
    return nextMap
  }, [])

  const setPreviewScrollTopProgrammatically = useCallback((target: number) => {
    const root = previewRootRef.current
    if (!root) return
    suppressPreviewScrollRef.current = true
    const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
    root.scrollTop = clamp(target, 0, maxScrollTop)
    window.requestAnimationFrame(() => {
      suppressPreviewScrollRef.current = false
    })
  }, [])

  const setEditorScrollTopProgrammatically = useCallback((target: number) => {
    const view = editorViewRef.current
    if (!view) return
    const scrollDom = view.scrollDOM
    suppressEditorScrollRef.current = true
    const maxScrollTop = Math.max(0, scrollDom.scrollHeight - scrollDom.clientHeight)
    scrollDom.scrollTop = clamp(target, 0, maxScrollTop)
    window.requestAnimationFrame(() => {
      suppressEditorScrollRef.current = false
    })
  }, [])

  const syncPreviewToCursorLine = useCallback((line: number) => {
    if (activeScrollSourceRef.current !== null) {
      pendingCursorLineRef.current = line
      return
    }

    const root = previewRootRef.current
    const scrollMap = getOrBuildScrollMap()
    if (!root || !scrollMap) {
      pendingCursorLineRef.current = line
      return
    }

    const previewY = mapSourceLineToPreviewY(line, scrollMap)
    if (previewY == null) return

    const target = previewY - root.clientHeight * CURSOR_REVEAL_RATIO
    pendingCursorLineRef.current = undefined
    setPreviewScrollTopProgrammatically(clamp(target, 0, scrollMap.previewMaxScrollTop))
  }, [getOrBuildScrollMap, setPreviewScrollTopProgrammatically])

  const scheduleCursorSync = useCallback((line: number) => {
    pendingCursorLineRef.current = line
    if (cursorSyncFrameRef.current !== undefined) return
    cursorSyncFrameRef.current = window.requestAnimationFrame(() => {
      cursorSyncFrameRef.current = undefined
      const pendingLine = pendingCursorLineRef.current
      if (pendingLine !== undefined) syncPreviewToCursorLine(pendingLine)
    })
  }, [syncPreviewToCursorLine])

  const releaseActiveSource = useCallback(() => {
    activeScrollSourceRef.current = null
    const pendingLine = pendingCursorLineRef.current
    if (pendingLine !== undefined) scheduleCursorSync(pendingLine)
  }, [scheduleCursorSync])

  const markActiveSource = useCallback((source: Exclude<ScrollSource, null>) => {
    activeScrollSourceRef.current = source
    window.clearTimeout(scrollSourceReleaseTimerRef.current)
    scrollSourceReleaseTimerRef.current = window.setTimeout(releaseActiveSource, SCROLL_SOURCE_RELEASE_DELAY)
  }, [releaseActiveSource])

  const syncPreviewFromEditor = useCallback(() => {
    const view = editorViewRef.current
    if (!view) return

    const scrollMap = getOrBuildScrollMap()
    const editorScrollTop = view.scrollDOM.scrollTop
    if (!scrollMap || scrollMap.editorYs.length < 2 || scrollMap.editorYs.length !== scrollMap.previewYs.length) {
      const editorMax = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)
      const root = previewRootRef.current
      const previewMax = root ? Math.max(0, root.scrollHeight - root.clientHeight) : 0
      setPreviewScrollTopProgrammatically(mapByGlobalRatio(editorScrollTop, editorMax, previewMax))
      return
    }

    if (editorScrollTop >= scrollMap.editorMaxScrollTop - 2) {
      setPreviewScrollTopProgrammatically(scrollMap.previewMaxScrollTop)
      return
    }

    const target = mapScrollTop(editorScrollTop, scrollMap.editorYs, scrollMap.previewYs)
    setPreviewScrollTopProgrammatically(clamp(target, 0, scrollMap.previewMaxScrollTop))
  }, [getOrBuildScrollMap, setPreviewScrollTopProgrammatically])

  const syncEditorFromPreview = useCallback(() => {
    const root = previewRootRef.current
    if (!root) return

    const scrollMap = getOrBuildScrollMap()
    const previewScrollTop = root.scrollTop
    if (!scrollMap || scrollMap.previewYs.length < 2 || scrollMap.previewYs.length !== scrollMap.editorYs.length) {
      const previewMax = Math.max(0, root.scrollHeight - root.clientHeight)
      const view = editorViewRef.current
      const editorMax = view ? Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight) : 0
      setEditorScrollTopProgrammatically(mapByGlobalRatio(previewScrollTop, previewMax, editorMax))
      return
    }

    if (previewScrollTop >= scrollMap.previewMaxScrollTop - 2) {
      setEditorScrollTopProgrammatically(scrollMap.editorMaxScrollTop)
      return
    }

    const target = mapScrollTop(previewScrollTop, scrollMap.previewYs, scrollMap.editorYs)
    setEditorScrollTopProgrammatically(clamp(target, 0, scrollMap.editorMaxScrollTop))
  }, [getOrBuildScrollMap, setEditorScrollTopProgrammatically])

  const scheduleEditorToPreviewSync = useCallback(() => {
    if (editorToPreviewFrameRef.current !== undefined) return
    editorToPreviewFrameRef.current = window.requestAnimationFrame(() => {
      editorToPreviewFrameRef.current = undefined
      syncPreviewFromEditor()
    })
  }, [syncPreviewFromEditor])

  const schedulePreviewToEditorSync = useCallback(() => {
    if (previewToEditorFrameRef.current !== undefined) return
    previewToEditorFrameRef.current = window.requestAnimationFrame(() => {
      previewToEditorFrameRef.current = undefined
      syncEditorFromPreview()
    })
  }, [syncEditorFromPreview])

  const handlePreviewContentChange = useCallback(() => {
    invalidateScrollMap()
    if (activeScrollSourceRef.current === 'editor') scheduleEditorToPreviewSync()
    else if (activeScrollSourceRef.current === 'preview') schedulePreviewToEditorSync()
  }, [invalidateScrollMap, scheduleEditorToPreviewSync, schedulePreviewToEditorSync])

  const handleEditorViewChange = useCallback((view: EditorView | null) => {
    editorViewRef.current = view
    setEditorView(view)
    invalidateScrollMap()
  }, [invalidateScrollMap])

  const handlePreviewRootReady = useCallback((root: HTMLDivElement | null) => {
    previewRootRef.current = root
    setPreviewRoot(root)
    invalidateScrollMap()
  }, [invalidateScrollMap])

  const handlePreviewSyncPositionChange = useCallback((position: PreviewSyncPosition) => {
    if (position.source !== 'cursor') return
    latestCursorLineRef.current = position.line
    scheduleCursorSync(position.line)
  }, [scheduleCursorSync])

  useEffect(() => {
    onAssetObjectUrlsChangeRef.current = onAssetObjectUrlsChange
  }, [onAssetObjectUrlsChange])

  useEffect(() => {
    if (!onAssetObjectUrlsChangeRef.current) {
      return undefined
    }
    if (assets.length === 0) {
      onAssetObjectUrlsChangeRef.current({})
      return undefined
    }
    const assetsNeedingObjectUrls = assets.filter((asset) => !asset.publicUrl)
    if (assetsNeedingObjectUrls.length === 0) {
      onAssetObjectUrlsChangeRef.current({})
      return undefined
    }

    let disposed = false
    const objectUrls: Record<string, string> = {}
    void Promise.all(
      assetsNeedingObjectUrls.map(async (asset) => {
        const response = await fetch(buildApiUrl(`/assets/blob?key=${encodeURIComponent(asset.key)}`), {
          credentials: 'include',
        })
        if (!response.ok) return
        const blob = await response.blob()
        if (disposed) return
        objectUrls[asset.key] = URL.createObjectURL(blob)
      }),
    ).then(() => {
      if (!disposed) onAssetObjectUrlsChangeRef.current?.(objectUrls)
    })

    return () => {
      disposed = true
      for (const url of Object.values(objectUrls)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [assets])

  useEffect(() => {
    invalidateScrollMap()
  }, [invalidateScrollMap, markdown])

  useEffect(() => {
    if (!editorView || !previewRoot) return
    scheduleCursorSync(latestCursorLineRef.current)
  }, [editorView, previewRoot, scheduleCursorSync])

  useEffect(() => {
    if (!editorView) return undefined

    const handleEditorScroll = () => {
      if (suppressEditorScrollRef.current) return
      if (activeScrollSourceRef.current !== null && activeScrollSourceRef.current !== 'editor') return

      markActiveSource('editor')
      scheduleEditorToPreviewSync()
    }

    const scrollDom = editorView.scrollDOM
    scrollDom.addEventListener('scroll', handleEditorScroll, { passive: true })
    return () => scrollDom.removeEventListener('scroll', handleEditorScroll)
  }, [editorView, markActiveSource, scheduleEditorToPreviewSync])

  useEffect(() => {
    if (!previewRoot) return undefined

    const handlePreviewScroll = () => {
      if (suppressPreviewScrollRef.current) return
      if (activeScrollSourceRef.current !== null && activeScrollSourceRef.current !== 'preview') return

      markActiveSource('preview')
      schedulePreviewToEditorSync()
    }

    previewRoot.addEventListener('scroll', handlePreviewScroll, { passive: true })
    return () => previewRoot.removeEventListener('scroll', handlePreviewScroll)
  }, [markActiveSource, previewRoot, schedulePreviewToEditorSync])

  useEffect(() => {
    const view = editorView
    const root = previewRoot
    if (typeof ResizeObserver === 'undefined' || (!view && !root)) return undefined

    const observer = new ResizeObserver(invalidateScrollMap)
    if (view) {
      observer.observe(view.scrollDOM)
      observer.observe(view.dom)
    }
    if (root) observer.observe(root)

    return () => observer.disconnect()
  }, [editorView, invalidateScrollMap, previewRoot])

  useEffect(() => {
    const handleWindowResize = () => invalidateScrollMap()
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [invalidateScrollMap])

  useEffect(() => {
    return () => {
      window.clearTimeout(scrollSourceReleaseTimerRef.current)
      if (editorToPreviewFrameRef.current !== undefined) window.cancelAnimationFrame(editorToPreviewFrameRef.current)
      if (previewToEditorFrameRef.current !== undefined) window.cancelAnimationFrame(previewToEditorFrameRef.current)
      if (cursorSyncFrameRef.current !== undefined) window.cancelAnimationFrame(cursorSyncFrameRef.current)
    }
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.column}>
        <MarkdownEditor
          value={markdown}
          onChange={onChange}
          onPreviewSyncPositionChange={handlePreviewSyncPositionChange}
          onEditorViewChange={handleEditorViewChange}
          insertRequest={insertRequest}
          onInsertConsumed={onInsertConsumed}
          onPasteImages={onPasteImages}
          documentKey={documentKey}
        />
      </div>
      <div className={mergeClasses(styles.column, styles.previewColumn)}>
        <MarkdownPreview
          markdown={markdown}
          resolveResourceUrl={resolveResourceUrl}
          onPreviewRootReady={handlePreviewRootReady}
          onPreviewContentChange={handlePreviewContentChange}
        />
      </div>
    </div>
  )
}
