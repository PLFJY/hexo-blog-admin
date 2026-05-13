import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { EditorView } from '@uiw/react-codemirror'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import type { MermaidRenderError } from './MarkdownPreview'
import { buildApiUrl } from '../lib/apiClient'
import type { ResolvedMarkdownResourceUrl } from '../lib/markdownResource'
import type { DraftAsset } from '../shared/assetTypes'

const SINGLE_COLUMN_MEDIA_QUERY = '(max-width: 960px)'

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
    [`@media ${SINGLE_COLUMN_MEDIA_QUERY}`]: {
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
    paddingTop: `calc(var(--hba-editor-toolbar-height, 32px) + ${tokens.spacingVerticalXS})`,
    [`@media ${SINGLE_COLUMN_MEDIA_QUERY}`]: {
      paddingTop: 0,
    },
  },
})

/**
 * 滚动同步手感调参区。
 *
 * 推荐调参顺序：
 * 1. 慢滚仍断续：增大 scrollSourceReleaseDelay。
 * 2. 细碎抖动：增大 programmaticScrollEpsilon。
 * 3. 同步准但手感硬：降低 editorToPreviewSemanticWeight。
 * 4. 手感顺但偏移明显：提高 editorToPreviewSemanticWeight。
 * 5. 预览滚编辑器时卡：增大 previewToEditorSettleDelay。
 */
const SYNC_TUNING = {
  /**
   * active source 保持时间。
   * 慢速触控板滚动时，两次 scroll 事件间隔可能较大。
   * 值太小会导致 active source 反复释放，引发 cursor/rebuild 插入滚动链路。
   *
   * 建议范围：
   * 600: 反应较快
   * 800: 推荐默认
   * 1000: 更稳，但双向切换稍钝
   */
  scrollSourceReleaseDelay: 800,

  /**
   * 程序性设置 scrollTop 时，小于该像素差就不设置。
   * 值越大越顺，但同步越钝。
   *
   * 建议范围：1 ~ 3
   */
  programmaticScrollEpsilon: 2,

  /**
   * PreviewLineMap 延迟重建时间。
   * 值越大越不抢滚动帧，但图片/布局变化后的修正越慢。
   *
   * 建议范围：120 ~ 250
   */
  scrollMapRebuildDelay: 180,

  /**
   * 编辑器滚动同步取样点。
   * 取顶部向下少量偏移，避免顶部半行抖动。
   */
  editorScrollAnchorYOffset: 16,

  /**
   * 编辑内容后，让目标行出现在预览区高度的哪个位置。
   */
  editRevealRatio: 0.28,

  /**
   * 内容编辑前预览接近底部时，编辑后继续贴住新底部的容差。
   */
  contentEditBottomStickEpsilon: 8,

  /**
   * editor -> preview 的语义同步权重。
   *
   * 1.0: 完全按源码行语义同步，最准，但可能有锚点感。
   * 0.75: 推荐默认，语义为主，混一点比例同步，手感更顺。
   * 0.65: 更顺，但可能略偏。
   */
  editorToPreviewSemanticWeight: 0.75,

  /**
   * preview -> editor 滚动中只做比例轻量跟随。
   * 停止滚动后过多久再用源码行校准。
   *
   * 值越大越顺，值越小越准。
   */
  previewToEditorSettleDelay: 450,

  /**
   * 用户 pointer 仍停在 editor / preview 上时，是否推迟 map rebuild。
   * 开启后滚动手感更稳。
   */
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
  onSaveShortcut?: () => void
  onMermaidRenderErrorsChange?: (errors: MermaidRenderError[]) => void
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const mapByGlobalRatio = (sourceScrollTop: number, sourceMax: number, targetMax: number) => {
  if (sourceMax <= 0) return 0
  return targetMax * (sourceScrollTop / sourceMax)
}

const getPreviewY = (previewRoot: HTMLElement, element: HTMLElement) => {
  // 如果 MarkdownPreview.root 设置了 position: relative，则 offsetTop 会更轻。
  // 这里保留 rect fallback，避免 offsetParent 不在 previewRoot 时计算不准。
  if (element.offsetParent === previewRoot) return element.offsetTop

  const rootRect = previewRoot.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  return elementRect.top - rootRect.top + previewRoot.scrollTop
}

const hasPendingMermaidBlocks = (root: HTMLElement) =>
  Boolean(root.querySelector('.hba-mermaid[data-mermaid-status="pending"]'))

const buildPreviewLineMap = (view: EditorView, previewRoot: HTMLElement): PreviewLineMap => {
  const previewMaxScrollTop = Math.max(0, previewRoot.scrollHeight - previewRoot.clientHeight)
  const anchorByLine = new Map<number, number>([[1, 0]])
  const addAnchor = (line: number, previewY: number, mode: 'min' | 'max') => {
    const safeLine = Math.min(view.state.doc.lines, Math.max(1, Math.floor(line)))
    const safePreviewY = clamp(previewY, 0, previewMaxScrollTop)
    const current = anchorByLine.get(safeLine)
    if (current == null) {
      anchorByLine.set(safeLine, safePreviewY)
      return
    }

    anchorByLine.set(safeLine, mode === 'min' ? Math.min(current, safePreviewY) : Math.max(current, safePreviewY))
  }

  const previewAnchors = Array.from(previewRoot.querySelectorAll<HTMLElement>('[data-source-line]'))
    .map((element) => ({
      element,
      startLine: Number(element.dataset.sourceLine),
      endLine: Number(element.dataset.sourceEndLine),
    }))
    .filter((anchor) => Number.isFinite(anchor.startLine) && anchor.startLine >= 1)
    .sort((a, b) => a.startLine - b.startLine)

  for (const anchor of previewAnchors) {
    const previewY = getPreviewY(previewRoot, anchor.element)
    if (!Number.isFinite(previewY)) continue

    const startLine = Math.min(view.state.doc.lines, Math.max(1, Math.floor(anchor.startLine)))
    const endLine = Number.isFinite(anchor.endLine)
      ? Math.min(view.state.doc.lines, Math.max(startLine, Math.floor(anchor.endLine)))
      : startLine
    addAnchor(startLine, previewY, 'min')

    if (endLine > startLine) {
      const rectHeight = anchor.element.getBoundingClientRect().height
      const elementHeight = Number.isFinite(rectHeight) && rectHeight > 0 ? rectHeight : anchor.element.offsetHeight
      addAnchor(endLine, previewY + elementHeight, 'max')
    }
  }

  const anchors = Array.from(anchorByLine.entries()).map(([line, previewY]) => ({ line, previewY }))
  anchors.sort((a, b) => a.line - b.line)

  const normalized: SourceAnchor[] = []
  for (const anchor of anchors) {
    const previous = normalized[normalized.length - 1]
    if (previous && anchor.previewY < previous.previewY) continue
    normalized.push(anchor)
  }

  const bottomAnchor: SourceAnchor = {
    line: view.state.doc.lines,
    previewY: previewMaxScrollTop,
  }

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

const getPreviewYForSourceLine = (previewRoot: HTMLElement, line: number) => {
  const anchors = Array.from(previewRoot.querySelectorAll<HTMLElement>('[data-source-line]'))
    .map((element) => {
      const startLine = Number(element.dataset.sourceLine)
      const endLine = Number(element.dataset.sourceEndLine)
      return {
        element,
        startLine,
        endLine: Number.isFinite(endLine) ? endLine : startLine,
      }
    })
    .filter((anchor) => Number.isFinite(anchor.startLine) && anchor.startLine >= 1)
    .sort((a, b) => a.startLine - b.startLine)

  if (anchors.length === 0) return undefined

  const containing = anchors.find((anchor) => anchor.startLine <= line && anchor.endLine >= line)
  if (containing) {
    const startY = getPreviewY(previewRoot, containing.element)
    if (!Number.isFinite(startY)) return undefined

    if (containing.endLine <= containing.startLine) return startY

    const progress = clamp((line - containing.startLine) / (containing.endLine - containing.startLine), 0, 1)
    return startY + containing.element.offsetHeight * progress
  }

  const next = anchors.find((anchor) => anchor.startLine > line)
  const fallback = next ?? anchors[anchors.length - 1]
  const y = getPreviewY(previewRoot, fallback.element)
  return Number.isFinite(y) ? y : undefined
}

const isSourceLineBlockVisible = (previewRoot: HTMLElement, line: number) => {
  const anchors = Array.from(previewRoot.querySelectorAll<HTMLElement>('[data-source-line]'))
    .map((element) => {
      const startLine = Number(element.dataset.sourceLine)
      const endLine = Number(element.dataset.sourceEndLine)
      return {
        element,
        startLine,
        endLine: Number.isFinite(endLine) ? endLine : startLine,
      }
    })
    .filter((anchor) => Number.isFinite(anchor.startLine) && anchor.startLine >= 1)

  const containing = anchors.find((anchor) => anchor.startLine <= line && anchor.endLine >= line)
  if (!containing) return false

  const top = getPreviewY(previewRoot, containing.element)
  const bottom = top + containing.element.offsetHeight
  const viewportTop = previewRoot.scrollTop
  const viewportBottom = previewRoot.scrollTop + previewRoot.clientHeight

  return bottom > viewportTop + 8 && top < viewportBottom - 8
}

const getEditorTopVisibleLine = (view: EditorView) => {
  const rect = view.scrollDOM.getBoundingClientRect()
  const anchorYInViewport = SYNC_TUNING.editorScrollAnchorYOffset
  const pos = view.posAtCoords({
    x: rect.left + SYNC_TUNING.editorScrollAnchorYOffset,
    y: rect.top + anchorYInViewport,
  })

  if (pos == null) {
    return view.state.doc.lineAt(view.state.selection.main.head).number
  }

  const line = view.state.doc.lineAt(pos)
  const block = view.lineBlockAt(pos)
  const anchorYInDocument = view.scrollDOM.scrollTop + anchorYInViewport

  const progress =
    block.height > 0
      ? clamp((anchorYInDocument - block.top) / block.height, 0, 0.999)
      : 0

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
  onSaveShortcut,
  onMermaidRenderErrorsChange,
}: ArticleMarkdownWorkspaceProps) {
  const styles = useStyles()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [previewRoot, setPreviewRoot] = useState<HTMLDivElement | null>(null)
  const [editorToolbarHeight, setEditorToolbarHeight] = useState(32)

  const onAssetObjectUrlsChangeRef = useRef(onAssetObjectUrlsChange)
  const editorViewRef = useRef<EditorView | null>(null)
  const previewRootRef = useRef<HTMLDivElement | null>(null)

  const scrollMapRef = useRef<PreviewLineMap | undefined>(undefined)
  const scrollMapDirtyRef = useRef(true)
  const scrollMapRebuildTimerRef = useRef<number | undefined>(undefined)

  const activeScrollSourceRef = useRef<ScrollSource>(null)
  const pointerAreaRef = useRef<ScrollSource>(null)

  const suppressEditorScrollRef = useRef(false)
  const suppressPreviewScrollRef = useRef(false)
  const suppressPreviewScrollForContentEditRef = useRef(false)
  const editorSuppressTokenRef = useRef(0)
  const previewSuppressTokenRef = useRef(0)

  const scrollSourceReleaseTimerRef = useRef<number | undefined>(undefined)
  const editorToPreviewFrameRef = useRef<number | undefined>(undefined)
  const previewToEditorFrameRef = useRef<number | undefined>(undefined)
  const previewSettleTimerRef = useRef<number | undefined>(undefined)
  const isSingleColumnLayoutRef = useRef(false)
  const pendingContentEditSyncRef = useRef(false)
  const pendingContentEditLineRef = useRef<number | undefined>(undefined)
  const previewWasAtBottomBeforeContentEditRef = useRef(false)

  const rebuildScrollMap = useCallback(() => {
    const view = editorViewRef.current
    const root = previewRootRef.current
    if (!view || !root) return undefined
    if (hasPendingMermaidBlocks(root)) return scrollMapRef.current

    const nextMap = buildPreviewLineMap(view, root)
    scrollMapRef.current = nextMap
    scrollMapDirtyRef.current = false
    return nextMap
  }, [])

  const canRebuildScrollMapNow = useCallback(() => {
    if (activeScrollSourceRef.current !== null) return false
    if (SYNC_TUNING.deferRebuildWhilePointerInside && pointerAreaRef.current !== null) return false
    return true
  }, [])

  const scheduleScrollMapRebuild = useCallback(() => {
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
    if (!scrollMapDirtyRef.current && scrollMapRef.current) return scrollMapRef.current

    const root = previewRootRef.current
    if (root && hasPendingMermaidBlocks(root)) {
      if (scrollMapRef.current) return scrollMapRef.current
      return undefined
    }

    // 如果用户正在滚动，优先用旧 map，避免滚动帧里抢主线程重建。
    if (scrollMapRef.current && !canRebuildScrollMapNow()) return scrollMapRef.current

    return rebuildScrollMap()
  }, [canRebuildScrollMapNow, rebuildScrollMap])

  const setPreviewScrollTopProgrammatically = useCallback((target: number) => {
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
        if (previewSuppressTokenRef.current === token) {
          suppressPreviewScrollRef.current = false
        }
      })
    })
  }, [])

  const setEditorScrollTopProgrammatically = useCallback((target: number) => {
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
        if (editorSuppressTokenRef.current === token) {
          suppressEditorScrollRef.current = false
        }
      })
    })
  }, [])

  const setEditorScrollToLineProgrammatically = useCallback((lineNumber: number) => {
    const view = editorViewRef.current
    if (!view) return

    const token = editorSuppressTokenRef.current + 1
    editorSuppressTokenRef.current = token
    suppressEditorScrollRef.current = true

    scrollEditorToLine(view, lineNumber)

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (editorSuppressTokenRef.current === token) {
          suppressEditorScrollRef.current = false
        }
      })
    })
  }, [])

  const releaseActiveSource = useCallback(() => {
    activeScrollSourceRef.current = null

    if (scrollMapDirtyRef.current && canRebuildScrollMapNow()) {
      scheduleScrollMapRebuild()
    }
  }, [canRebuildScrollMapNow, scheduleScrollMapRebuild])

  const markActiveSource = useCallback((source: Exclude<ScrollSource, null>) => {
    activeScrollSourceRef.current = source
    window.clearTimeout(scrollSourceReleaseTimerRef.current)
    scrollSourceReleaseTimerRef.current = window.setTimeout(releaseActiveSource, SYNC_TUNING.scrollSourceReleaseDelay)
  }, [releaseActiveSource])

  const syncPreviewFromEditor = useCallback(() => {
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

  const syncPreviewToEditedLine = useCallback((line: number) => {
    const root = previewRootRef.current
    if (!root) return
    if (isSourceLineBlockVisible(root, line)) return

    const previewMaxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
    const previewY = getPreviewYForSourceLine(root, line)
    if (previewY == null) return

    const target = previewY - root.clientHeight * SYNC_TUNING.editRevealRatio
    setPreviewScrollTopProgrammatically(clamp(target, 0, previewMaxScrollTop))
  }, [setPreviewScrollTopProgrammatically])

  const settleEditorFromPreview = useCallback(() => {
    if (isSingleColumnLayoutRef.current) return

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

    if (!isSingleColumnLayoutRef.current) {
      previewSettleTimerRef.current = window.setTimeout(() => {
        if (activeScrollSourceRef.current === 'preview') {
          settleEditorFromPreview()
        }
      }, SYNC_TUNING.previewToEditorSettleDelay)
    }
  }, [setEditorScrollTopProgrammatically, settleEditorFromPreview])

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
    if (pendingContentEditSyncRef.current) {
      pendingContentEditSyncRef.current = false
      const line = pendingContentEditLineRef.current
      pendingContentEditLineRef.current = undefined

      if (previewWasAtBottomBeforeContentEditRef.current) {
        previewWasAtBottomBeforeContentEditRef.current = false

        window.requestAnimationFrame(() => {
          const root = previewRootRef.current
          if (!root) return

          const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
          setPreviewScrollTopProgrammatically(maxScrollTop)
        })
      } else if (line === undefined) {
        scheduleEditorToPreviewSync()
      } else {
        window.requestAnimationFrame(() => syncPreviewToEditedLine(line))
      }
    }

    if (suppressPreviewScrollForContentEditRef.current) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          suppressPreviewScrollForContentEditRef.current = false
        })
      })
    }
  }, [invalidateScrollMap, scheduleEditorToPreviewSync, setPreviewScrollTopProgrammatically, syncPreviewToEditedLine])

  const cancelPreviewDrivenSync = useCallback(() => {
    if (activeScrollSourceRef.current === 'preview') activeScrollSourceRef.current = null
    if (pointerAreaRef.current === 'preview') pointerAreaRef.current = null
    window.clearTimeout(scrollSourceReleaseTimerRef.current)
    window.clearTimeout(previewSettleTimerRef.current)

    if (previewToEditorFrameRef.current !== undefined) {
      window.cancelAnimationFrame(previewToEditorFrameRef.current)
      previewToEditorFrameRef.current = undefined
    }
  }, [])

  const handleContentEdit = useCallback((line?: number) => {
    cancelPreviewDrivenSync()

    const root = previewRootRef.current
    if (root) {
      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
      previewWasAtBottomBeforeContentEditRef.current =
        root.scrollTop >= maxScrollTop - SYNC_TUNING.contentEditBottomStickEpsilon
    } else {
      previewWasAtBottomBeforeContentEditRef.current = false
    }

    suppressPreviewScrollForContentEditRef.current = true
    pendingContentEditSyncRef.current = true
    pendingContentEditLineRef.current = line
  }, [cancelPreviewDrivenSync])

  const handleEditorViewChange = useCallback((view: EditorView | null) => {
    editorViewRef.current = view
    setEditorView(view)
    invalidateScrollMap()
  }, [invalidateScrollMap])

  const handleEditorToolbarHeightChange = useCallback((height: number) => {
    setEditorToolbarHeight((current) => (Math.abs(current - height) < 1 ? current : height))
    invalidateScrollMap()
  }, [invalidateScrollMap])

  const handlePreviewRootReady = useCallback((root: HTMLDivElement | null) => {
    previewRootRef.current = root
    setPreviewRoot(root)
    invalidateScrollMap()
  }, [invalidateScrollMap])

  useEffect(() => {
    onAssetObjectUrlsChangeRef.current = onAssetObjectUrlsChange
  }, [onAssetObjectUrlsChange])

  useEffect(() => {
    const mediaQuery = window.matchMedia(SINGLE_COLUMN_MEDIA_QUERY)

    const updateLayoutMode = () => {
      isSingleColumnLayoutRef.current = mediaQuery.matches

      if (mediaQuery.matches) {
        // 切到单列时，取消已经排队的 settle，避免之后触发 scrollIntoView。
        window.clearTimeout(previewSettleTimerRef.current)
      }
    }

    updateLayoutMode()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateLayoutMode)
      return () => mediaQuery.removeEventListener('change', updateLayoutMode)
    }

    mediaQuery.addListener(updateLayoutMode)
    return () => mediaQuery.removeListener(updateLayoutMode)
  }, [])

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
    if (!editorView) return undefined

    const handleEditorScroll = () => {
      if (suppressEditorScrollRef.current) return
      if (pointerAreaRef.current !== null && pointerAreaRef.current !== 'editor') return
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
      if (suppressPreviewScrollRef.current) return
      if (suppressPreviewScrollForContentEditRef.current) return
      if (pointerAreaRef.current !== null && pointerAreaRef.current !== 'preview') return
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

    // 不观察 view.dom，避免 CodeMirror 内部虚拟渲染变化导致频繁 invalidation。
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
    }
  }, [])

  const handleEditorPointerEnter = useCallback(() => {
    pointerAreaRef.current = 'editor'
  }, [])

  const handleEditorPointerLeave = useCallback(() => {
    if (pointerAreaRef.current === 'editor') {
      pointerAreaRef.current = null
      if (scrollMapDirtyRef.current) scheduleScrollMapRebuild()
    }
  }, [scheduleScrollMapRebuild])

  const handlePreviewPointerEnter = useCallback(() => {
    pointerAreaRef.current = 'preview'
  }, [])

  const handlePreviewPointerLeave = useCallback(() => {
    if (pointerAreaRef.current === 'preview') {
      pointerAreaRef.current = null
      if (scrollMapDirtyRef.current) scheduleScrollMapRebuild()
    }
  }, [scheduleScrollMapRebuild])

  return (
    <div
      className={styles.root}
      style={{ '--hba-editor-toolbar-height': `${editorToolbarHeight}px` } as CSSProperties}
    >
      <div
        className={styles.column}
        onPointerEnter={handleEditorPointerEnter}
        onPointerLeave={handleEditorPointerLeave}
        onPointerDown={handleEditorPointerEnter}
        onTouchStart={handleEditorPointerEnter}
      >
        <MarkdownEditor
          value={markdown}
          onChange={onChange}
          onEditorViewChange={handleEditorViewChange}
          onToolbarHeightChange={handleEditorToolbarHeightChange}
          onContentEdit={handleContentEdit}
          insertRequest={insertRequest}
          onInsertConsumed={onInsertConsumed}
          onPasteImages={onPasteImages}
          onSaveShortcut={onSaveShortcut}
        />
      </div>
      <div
        className={mergeClasses(styles.column, styles.previewColumn)}
        onPointerEnter={handlePreviewPointerEnter}
        onPointerLeave={handlePreviewPointerLeave}
        onPointerDown={handlePreviewPointerEnter}
        onTouchStart={handlePreviewPointerEnter}
      >
        <MarkdownPreview
          markdown={markdown}
          resolveResourceUrl={resolveResourceUrl}
          onPreviewRootReady={handlePreviewRootReady}
          onPreviewContentChange={handlePreviewContentChange}
          onMermaidRenderErrorsChange={onMermaidRenderErrorsChange}
        />
      </div>
    </div>
  )
}
