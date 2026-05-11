import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { EditorView } from '@uiw/react-codemirror'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownEditor } from './MarkdownEditor'
import type { PreviewSyncPosition } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { buildApiUrl } from '../lib/apiClient'
import type { ResolvedMarkdownResourceUrl } from '../lib/markdownResource'
import type { DraftAsset } from '../shared/assetTypes'

const MOBILE_SYNC_MEDIA_QUERY = '(max-width: 960px)'

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
      overflow: 'visible',
    },
  },
  column: {
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    '@media (max-width: 960px)': {
      overflow: 'visible',
    },
  },
  previewColumn: {
    paddingTop: `calc(32px + ${tokens.spacingVerticalXS})`,
    '@media (max-width: 960px)': {
      paddingTop: 0,
    },
  },
})

const SYNC_TUNING = {
  scrollSourceReleaseDelay: 800,
  programmaticScrollEpsilon: 2,
  scrollMapRebuildDelay: 180,
  editorScrollAnchorYOffset: 16,
  cursorRevealRatio: 0.18,
  editorToPreviewSemanticWeight: 0.75,
  previewToEditorSettleDelay: 450,
  deferRebuildWhilePointerInside: true,
} as const

type PreviewLineMap = {
  lines: number[]
  previewYs: number[]
  previewMaxScrollTop: number
}

type ScrollSource = 'editor' | 'preview' | null

type SourceAnchor = {
  line: number
  previewY: number
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
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const mapByGlobalRatio = (sourceScrollTop: number, sourceMax: number, targetMax: number) => {
  if (sourceMax <= 0) return 0
  return targetMax * (sourceScrollTop / sourceMax)
}

const getPreviewY = (previewRoot: HTMLElement, element: HTMLElement) => {
  if (element.offsetParent === previewRoot) return element.offsetTop

  const rootRect = previewRoot.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  return elementRect.top - rootRect.top + previewRoot.scrollTop
}

const buildPreviewLineMap = (view: EditorView, previewRoot: HTMLElement): PreviewLineMap => {
  const previewMaxScrollTop = Math.max(0, previewRoot.scrollHeight - previewRoot.clientHeight)
  const anchors: SourceAnchor[] = [{ line: 1, previewY: 0 }]
  const seenLines = new Set<number>([1])

  const previewAnchors = Array.from(previewRoot.querySelectorAll<HTMLElement>('[data-source-line]'))
    .map((element) => ({ element, line: Number(element.dataset.sourceLine) }))
    .filter((anchor) => Number.isFinite(anchor.line) && anchor.line >= 1)
    .sort((a, b) => a.line - b.line)

  for (const anchor of previewAnchors) {
    const line = Math.min(view.state.doc.lines, Math.max(1, Math.floor(anchor.line)))
    if (seenLines.has(line)) continue

    const previewY = getPreviewY(previewRoot, anchor.element)
    if (!Number.isFinite(previewY)) continue

    seenLines.add(line)
    anchors.push({ line, previewY: clamp(previewY, 0, previewMaxScrollTop) })
  }

  anchors.sort((a, b) => a.line - b.line)

  const normalized: SourceAnchor[] = []
  for (const anchor of anchors) {
    const previous = normalized[normalized.length - 1]
    if (previous && anchor.previewY < previous.previewY) continue
    normalized.push(anchor)
  }

  const bottomAnchor: SourceAnchor = { line: view.state.doc.lines, previewY: previewMaxScrollTop }
  const last = normalized[normalized.length - 1]
  if (!last) normalized.push(bottomAnchor)
  else if (last.line === bottomAnchor.line) normalized[normalized.length - 1] = bottomAnchor
  else normalized.push(bottomAnchor)

  return {
    lines: normalized.map((anchor) => anchor.line),
    previewYs: normalized.map((anchor) => anchor.previewY),
    previewMaxScrollTop,
  }
}

const mapSourceLineToPreviewY = (line: number, lineMap: PreviewLineMap) => {
  const { lines, previewYs } = lineMap
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

const mapPreviewYToSourceLine = (previewY: number, lineMap: PreviewLineMap) => {
  const { lines, previewYs } = lineMap
  if (lines.length === 0 || lines.length !== previewYs.length) return undefined
  if (previewY <= previewYs[0]) return lines[0]
  if (previewY >= previewYs[previewYs.length - 1]) return lines[lines.length - 1]

  let low = 0
  let high = previewYs.length - 1
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (previewYs[mid] > previewY) high = mid
    else low = mid + 1
  }

  const index = low
  const yStart = previewYs[index - 1]
  const yEnd = previewYs[index]
  const lineStart = lines[index - 1]
  const lineEnd = lines[index]
  if (yEnd === yStart) return lineStart

  const progress = (previewY - yStart) / (yEnd - yStart)
  return Math.round(lineStart + progress * (lineEnd - lineStart))
}

const getEditorTopVisibleLine = (view: EditorView) => {
  const rect = view.scrollDOM.getBoundingClientRect()
  const anchorYInViewport = SYNC_TUNING.editorScrollAnchorYOffset
  const pos = view.posAtCoords({
    x: rect.left + SYNC_TUNING.editorScrollAnchorYOffset,
    y: rect.top + anchorYInViewport,
  })

  if (pos == null) return view.state.doc.lineAt(view.state.selection.main.head).number

  const line = view.state.doc.lineAt(pos)
  const block = view.lineBlockAt(pos)
  const anchorYInDocument = view.scrollDOM.scrollTop + anchorYInViewport
  const progress = block.height > 0 ? clamp((anchorYInDocument - block.top) / block.height, 0, 0.999) : 0

  return line.number + progress
}

const scrollEditorToLine = (view: EditorView, lineNumber: number) => {
  const safeLine = Math.max(1, Math.min(view.state.doc.lines, Math.round(lineNumber)))
  const line = view.state.doc.line(safeLine)

  view.dispatch({
    effects: EditorView.scrollIntoView(line.from, {
      y: 'start',
      yMargin: SYNC_TUNING.editorScrollAnchorYOffset,
    }),
  })
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
}: ArticleMarkdownWorkspaceProps) {
  const styles = useStyles()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [previewRoot, setPreviewRoot] = useState<HTMLDivElement | null>(null)
  const [, setIsMobileLayout] = useState(false)

  const onAssetObjectUrlsChangeRef = useRef(onAssetObjectUrlsChange)
  const editorViewRef = useRef<EditorView | null>(null)
  const previewRootRef = useRef<HTMLDivElement | null>(null)
  const isMobileLayoutRef = useRef(false)

  const scrollMapRef = useRef<PreviewLineMap | undefined>(undefined)
  const scrollMapDirtyRef = useRef(true)
  const scrollMapRebuildTimerRef = useRef<number | undefined>(undefined)

  const activeScrollSourceRef = useRef<ScrollSource>(null)
  const pointerAreaRef = useRef<ScrollSource>(null)

  const suppressEditorScrollRef = useRef(false)
  const suppressPreviewScrollRef = useRef(false)
  const editorSuppressTokenRef = useRef(0)
  const previewSuppressTokenRef = useRef(0)

  const scrollSourceReleaseTimerRef = useRef<number | undefined>(undefined)
  const editorToPreviewFrameRef = useRef<number | undefined>(undefined)
  const previewToEditorFrameRef = useRef<number | undefined>(undefined)
  const cursorSyncFrameRef = useRef<number | undefined>(undefined)
  const previewSettleTimerRef = useRef<number | undefined>(undefined)

  const latestCursorLineRef = useRef(1)
  const pendingCursorLineRef = useRef<number | undefined>(undefined)
  const hasPendingCursorSyncRef = useRef(false)

  const clearScrollSyncState = useCallback(() => {
    activeScrollSourceRef.current = null
    pointerAreaRef.current = null
    hasPendingCursorSyncRef.current = false
    pendingCursorLineRef.current = undefined
    window.clearTimeout(scrollSourceReleaseTimerRef.current)
    window.clearTimeout(previewSettleTimerRef.current)
  }, [])

  const rebuildScrollMap = useCallback(() => {
    const view = editorViewRef.current
    const root = previewRootRef.current
    if (!view || !root) return undefined

    const nextMap = buildPreviewLineMap(view, root)
    scrollMapRef.current = nextMap
    scrollMapDirtyRef.current = false
    return nextMap
  }, [])

  const canRebuildScrollMapNow = useCallback(() => {
    if (isMobileLayoutRef.current) return false
    if (activeScrollSourceRef.current !== null) return false
    if (SYNC_TUNING.deferRebuildWhilePointerInside && pointerAreaRef.current !== null) return false
    return true
  }, [])

  const scheduleScrollMapRebuild = useCallback(() => {
    if (isMobileLayoutRef.current) return
    if (scrollMapRebuildTimerRef.current !== undefined) return

    scrollMapRebuildTimerRef.current = window.setTimeout(() => {
      scrollMapRebuildTimerRef.current = undefined
      if (!scrollMapDirtyRef.current) return
      if (!canRebuildScrollMapNow()) return
      rebuildScrollMap()
    }, SYNC_TUNING.scrollMapRebuildDelay)
  }, [canRebuildScrollMapNow, rebuildScrollMap])

  const invalidateScrollMap = useCallback(() => {
    scrollMapDirtyRef.current = true
    if (canRebuildScrollMapNow()) scheduleScrollMapRebuild()
  }, [canRebuildScrollMapNow, scheduleScrollMapRebuild])

  const getOrBuildScrollMap = useCallback(() => {
    if (isMobileLayoutRef.current) return undefined
    if (!scrollMapDirtyRef.current && scrollMapRef.current) return scrollMapRef.current
    if (scrollMapRef.current && !canRebuildScrollMapNow()) return scrollMapRef.current
    return rebuildScrollMap()
  }, [canRebuildScrollMapNow, rebuildScrollMap])

  const setPreviewScrollTopProgrammatically = useCallback((target: number) => {
    if (isMobileLayoutRef.current) return
    const root = previewRootRef.current
    if (!root) return

    const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
    const next = clamp(target, 0, maxScrollTop)
    if (Math.abs(root.scrollTop - next) < SYNC_TUNING.programmaticScrollEpsilon) return

    const token = previewSuppressTokenRef.current + 1
    previewSuppressTokenRef.current = token
    suppressPreviewScrollRef.current = true
    root.scrollTop = next

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (previewSuppressTokenRef.current === token) suppressPreviewScrollRef.current = false
      })
    })
  }, [])

  const setEditorScrollTopProgrammatically = useCallback((target: number) => {
    if (isMobileLayoutRef.current) return
    const view = editorViewRef.current
    if (!view) return

    const scrollDom = view.scrollDOM
    const maxScrollTop = Math.max(0, scrollDom.scrollHeight - scrollDom.clientHeight)
    const next = clamp(target, 0, maxScrollTop)
    if (Math.abs(scrollDom.scrollTop - next) < SYNC_TUNING.programmaticScrollEpsilon) return

    const token = editorSuppressTokenRef.current + 1
    editorSuppressTokenRef.current = token
    suppressEditorScrollRef.current = true
    scrollDom.scrollTop = next

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (editorSuppressTokenRef.current === token) suppressEditorScrollRef.current = false
      })
    })
  }, [])

  const setEditorScrollToLineProgrammatically = useCallback((lineNumber: number) => {
    if (isMobileLayoutRef.current) return
    const view = editorViewRef.current
    if (!view) return

    const token = editorSuppressTokenRef.current + 1
    editorSuppressTokenRef.current = token
    suppressEditorScrollRef.current = true
    scrollEditorToLine(view, lineNumber)

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (editorSuppressTokenRef.current === token) suppressEditorScrollRef.current = false
      })
    })
  }, [])

  const syncPreviewToCursorLine = useCallback((line: number) => {
    if (isMobileLayoutRef.current) return
    if (activeScrollSourceRef.current !== null) {
      pendingCursorLineRef.current = line
      hasPendingCursorSyncRef.current = true
      return
    }

    const root = previewRootRef.current
    const lineMap = getOrBuildScrollMap()
    if (!root || !lineMap) {
      pendingCursorLineRef.current = line
      hasPendingCursorSyncRef.current = true
      return
    }

    const previewY = mapSourceLineToPreviewY(line, lineMap)
    if (previewY == null) return

    const target = previewY - root.clientHeight * SYNC_TUNING.cursorRevealRatio
    pendingCursorLineRef.current = undefined
    hasPendingCursorSyncRef.current = false
    setPreviewScrollTopProgrammatically(clamp(target, 0, lineMap.previewMaxScrollTop))
  }, [getOrBuildScrollMap, setPreviewScrollTopProgrammatically])

  const scheduleCursorSync = useCallback((line: number) => {
    if (isMobileLayoutRef.current) return
    pendingCursorLineRef.current = line
    hasPendingCursorSyncRef.current = true

    if (cursorSyncFrameRef.current !== undefined) return

    cursorSyncFrameRef.current = window.requestAnimationFrame(() => {
      cursorSyncFrameRef.current = undefined
      const pendingLine = pendingCursorLineRef.current
      if (pendingLine !== undefined) syncPreviewToCursorLine(pendingLine)
    })
  }, [syncPreviewToCursorLine])

  const releaseActiveSource = useCallback(() => {
    activeScrollSourceRef.current = null
    hasPendingCursorSyncRef.current = false
    pendingCursorLineRef.current = undefined

    if (scrollMapDirtyRef.current && canRebuildScrollMapNow()) scheduleScrollMapRebuild()
  }, [canRebuildScrollMapNow, scheduleScrollMapRebuild])

  const markActiveSource = useCallback((source: Exclude<ScrollSource, null>) => {
    if (isMobileLayoutRef.current) return
    activeScrollSourceRef.current = source
    window.clearTimeout(scrollSourceReleaseTimerRef.current)
    scrollSourceReleaseTimerRef.current = window.setTimeout(releaseActiveSource, SYNC_TUNING.scrollSourceReleaseDelay)
  }, [releaseActiveSource])

  const syncPreviewFromEditor = useCallback(() => {
    if (isMobileLayoutRef.current) return
    const view = editorViewRef.current
    const root = previewRootRef.current
    if (!view || !root) return

    const lineMap = getOrBuildScrollMap()
    const editorScrollTop = view.scrollDOM.scrollTop
    const editorMaxScrollTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)
    const previewMaxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)

    if (!lineMap || lineMap.lines.length < 2 || lineMap.lines.length !== lineMap.previewYs.length) {
      setPreviewScrollTopProgrammatically(mapByGlobalRatio(editorScrollTop, editorMaxScrollTop, previewMaxScrollTop))
      return
    }

    if (editorScrollTop >= editorMaxScrollTop - 2) {
      setPreviewScrollTopProgrammatically(previewMaxScrollTop)
      return
    }

    const sourceLine = getEditorTopVisibleLine(view)
    const semanticTarget = mapSourceLineToPreviewY(sourceLine, lineMap)
    if (semanticTarget == null) {
      setPreviewScrollTopProgrammatically(mapByGlobalRatio(editorScrollTop, editorMaxScrollTop, previewMaxScrollTop))
      return
    }

    const ratioTarget = mapByGlobalRatio(editorScrollTop, editorMaxScrollTop, previewMaxScrollTop)
    const semanticWeight = clamp(SYNC_TUNING.editorToPreviewSemanticWeight, 0, 1)
    const target = semanticTarget * semanticWeight + ratioTarget * (1 - semanticWeight)

    setPreviewScrollTopProgrammatically(clamp(target, 0, lineMap.previewMaxScrollTop))
  }, [getOrBuildScrollMap, setPreviewScrollTopProgrammatically])

  const settleEditorFromPreview = useCallback(() => {
    if (isMobileLayoutRef.current) return
    const root = previewRootRef.current
    const view = editorViewRef.current
    if (!root || !view) return

    const lineMap = getOrBuildScrollMap()
    if (!lineMap || lineMap.previewYs.length < 2 || lineMap.previewYs.length !== lineMap.lines.length) return

    const previewScrollTop = root.scrollTop
    const previewMaxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
    const editorMaxScrollTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)

    if (previewScrollTop >= previewMaxScrollTop - 2) {
      setEditorScrollTopProgrammatically(editorMaxScrollTop)
      return
    }

    const line = mapPreviewYToSourceLine(previewScrollTop, lineMap)
    if (line == null) return

    setEditorScrollToLineProgrammatically(line)
  }, [getOrBuildScrollMap, setEditorScrollToLineProgrammatically, setEditorScrollTopProgrammatically])

  const syncEditorFromPreview = useCallback(() => {
    if (isMobileLayoutRef.current) return
    const root = previewRootRef.current
    const view = editorViewRef.current
    if (!root || !view) return

    const previewScrollTop = root.scrollTop
    const previewMaxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
    const editorMaxScrollTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)

    if (previewScrollTop >= previewMaxScrollTop - 2) {
      setEditorScrollTopProgrammatically(editorMaxScrollTop)
    } else {
      setEditorScrollTopProgrammatically(mapByGlobalRatio(previewScrollTop, previewMaxScrollTop, editorMaxScrollTop))
    }

    window.clearTimeout(previewSettleTimerRef.current)
    previewSettleTimerRef.current = window.setTimeout(() => {
      if (activeScrollSourceRef.current === 'preview') settleEditorFromPreview()
    }, SYNC_TUNING.previewToEditorSettleDelay)
  }, [setEditorScrollTopProgrammatically, settleEditorFromPreview])

  const scheduleEditorToPreviewSync = useCallback(() => {
    if (isMobileLayoutRef.current) return
    if (editorToPreviewFrameRef.current !== undefined) return

    editorToPreviewFrameRef.current = window.requestAnimationFrame(() => {
      editorToPreviewFrameRef.current = undefined
      syncPreviewFromEditor()
    })
  }, [syncPreviewFromEditor])

  const schedulePreviewToEditorSync = useCallback(() => {
    if (isMobileLayoutRef.current) return
    if (previewToEditorFrameRef.current !== undefined) return

    previewToEditorFrameRef.current = window.requestAnimationFrame(() => {
      previewToEditorFrameRef.current = undefined
      syncEditorFromPreview()
    })
  }, [syncEditorFromPreview])

  const handlePreviewContentChange = useCallback(() => {
    invalidateScrollMap()
    if (isMobileLayoutRef.current) return

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
    const query = window.matchMedia(MOBILE_SYNC_MEDIA_QUERY)
    const update = () => {
      isMobileLayoutRef.current = query.matches
      setIsMobileLayout(query.matches)

      if (query.matches) clearScrollSyncState()
      else invalidateScrollMap()
    }

    update()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    }

    query.addListener(update)
    return () => query.removeListener(update)
  }, [clearScrollSyncState, invalidateScrollMap])

  useEffect(() => {
    onAssetObjectUrlsChangeRef.current = onAssetObjectUrlsChange
  }, [onAssetObjectUrlsChange])

  useEffect(() => {
    if (!onAssetObjectUrlsChangeRef.current) return undefined
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
      for (const url of Object.values(objectUrls)) URL.revokeObjectURL(url)
    }
  }, [assets])

  useEffect(() => {
    invalidateScrollMap()
  }, [invalidateScrollMap, markdown])

  useEffect(() => {
    if (!editorView || !previewRoot || isMobileLayoutRef.current) return
    scheduleCursorSync(latestCursorLineRef.current)
  }, [editorView, previewRoot, scheduleCursorSync])

  useEffect(() => {
    if (!editorView) return undefined

    const handleEditorScroll = () => {
      if (isMobileLayoutRef.current) return
      if (suppressEditorScrollRef.current) return
      if (activeScrollSourceRef.current !== null && activeScrollSourceRef.current !== 'editor') return

      pointerAreaRef.current = 'editor'
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
      if (isMobileLayoutRef.current) return
      if (suppressPreviewScrollRef.current) return
      if (activeScrollSourceRef.current !== null && activeScrollSourceRef.current !== 'preview') return

      pointerAreaRef.current = 'preview'
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

    const observer = new ResizeObserver(() => {
      invalidateScrollMap()
    })

    if (view) observer.observe(view.scrollDOM)
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
      window.clearTimeout(scrollMapRebuildTimerRef.current)
      window.clearTimeout(previewSettleTimerRef.current)

      if (editorToPreviewFrameRef.current !== undefined) window.cancelAnimationFrame(editorToPreviewFrameRef.current)
      if (previewToEditorFrameRef.current !== undefined) window.cancelAnimationFrame(previewToEditorFrameRef.current)
      if (cursorSyncFrameRef.current !== undefined) window.cancelAnimationFrame(cursorSyncFrameRef.current)
    }
  }, [])

  const handleEditorPointerEnter = useCallback(() => {
    if (isMobileLayoutRef.current) return
    pointerAreaRef.current = 'editor'
  }, [])

  const handleEditorPointerLeave = useCallback(() => {
    if (isMobileLayoutRef.current) return
    if (pointerAreaRef.current === 'editor') {
      pointerAreaRef.current = null
      if (scrollMapDirtyRef.current) scheduleScrollMapRebuild()
    }
  }, [scheduleScrollMapRebuild])

  const handlePreviewPointerEnter = useCallback(() => {
    if (isMobileLayoutRef.current) return
    pointerAreaRef.current = 'preview'
  }, [])

  const handlePreviewPointerLeave = useCallback(() => {
    if (isMobileLayoutRef.current) return
    if (pointerAreaRef.current === 'preview') {
      pointerAreaRef.current = null
      if (scrollMapDirtyRef.current) scheduleScrollMapRebuild()
    }
  }, [scheduleScrollMapRebuild])

  return (
    <div className={styles.root}>
      <div
        className={styles.column}
        onPointerEnter={handleEditorPointerEnter}
        onPointerLeave={handleEditorPointerLeave}
      >
        <MarkdownEditor
          value={markdown}
          onChange={onChange}
          onPreviewSyncPositionChange={handlePreviewSyncPositionChange}
          onEditorViewChange={handleEditorViewChange}
          insertRequest={insertRequest}
          onInsertConsumed={onInsertConsumed}
          onPasteImages={onPasteImages}
        />
      </div>
      <div
        className={mergeClasses(styles.column, styles.previewColumn)}
        onPointerEnter={handlePreviewPointerEnter}
        onPointerLeave={handlePreviewPointerLeave}
      >
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
