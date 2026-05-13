import { markdown } from '@codemirror/lang-markdown'
import { copyLineDown, deleteLine, redo, undo } from '@codemirror/commands'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView, keymap, type ViewUpdate } from '@uiw/react-codemirror'
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowRedoRegular,
  ArrowUndoRegular,
  ChevronDownRegular,
  CodeBlockRegular,
  CodeRegular,
  HighlightRegular,
  LinkRegular,
  TextBoldRegular,
  TextItalicRegular,
  TextQuoteRegular,
  TextStrikethroughRegular,
  TextUnderlineRegular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppTheme } from '../app/ThemeProvider'
import { extractImageFilesFromPasteEvent } from '../lib/clipboardImages'

const useStyles = makeStyles({
  shell: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
  },
  splitButtonGroup: {
    display: 'inline-flex',
    gap: '1px',
    alignItems: 'center',
  },
  colorPopover: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    minWidth: '260px',
    padding: tokens.spacingVerticalM,
  },
  colorPicker: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
  },
  colorArea: {
    width: '100%',
    minWidth: '0 !important',
    minHeight: '0 !important',
    aspectRatio: '1',
  },
  colorSlider: {
    width: '100%',
    minWidth: '0 !important',
  },
  colorActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  iconWithIndicator: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
  },
  textColorGlyph: {
    fontSize: '17px',
    lineHeight: '20px',
    fontWeight: 200,
    color: tokens.colorNeutralForeground1,
  },
  colorIndicator: {
    position: 'absolute',
    right: '1px',
    bottom: '-2px',
    left: '1px',
    height: '3px',
    borderRadius: tokens.borderRadiusCircular,
    boxShadow: `0 0 0 1px ${tokens.colorNeutralStroke1}`,
  },
  root: {
    height: '560px',
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    '& .cm-editor': {
      height: '560px',
      fontSize: '14px',
      maxWidth: '100%',
      overflowX: 'hidden',
    },
    '& .cm-scroller': {
      height: '560px',
      overflow: 'auto',
      maxWidth: '100%',
      fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    },
    '& .cm-content': {
      padding: `${tokens.spacingVerticalM} 0`,
    },
  },
})

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  onPreviewSyncPositionChange?: (position: PreviewSyncPosition) => void
  onEditorViewChange?: (view: EditorView | null) => void
  onToolbarHeightChange?: (height: number) => void
  onContentEdit?: (line?: number) => void
  onSaveShortcut?: () => void
  insertRequest?: { id: number; text: string }
  onInsertConsumed?: (id: number) => void
  onPasteImages?: (files: File[]) => void
}

type FormatAction = 'bold' | 'italic' | 'link' | 'underline' | 'highlight' | 'inlineCode' | 'codeBlock' | 'quote' | 'strikethrough' | 'color'
export type PreviewSyncPosition = {
  line: number
  source: 'scroll' | 'cursor'
  fallbackRatio?: number
  immediate?: boolean
}

const clampRatio = (ratio: number) => Math.max(0, Math.min(1, ratio))
const defaultTextColor = '#ff0000'
const EDITOR_SCROLL_ANCHOR_Y_OFFSET = 16

const isApplePlatform = () =>
  typeof navigator !== 'undefined' && (/Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent))

const formatShortcut = (key: string) => `${isApplePlatform() ? '⌘' : 'Ctrl'} + ${key}`
const buildTooltip = (label: string, shortcut?: string) => (shortcut ? `${label} · ${shortcut}` : label)
const isShortcutModifierPressed = (event: KeyboardEvent) => (isApplePlatform() ? event.metaKey : event.ctrlKey)

function normalizeHexColor(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toLowerCase()
  }
  return null
}

type HsvColor = {
  h: number
  s: number
  v: number
  a?: number
}

function hexToHsv(hex: string): HsvColor {
  const normalized = normalizeHexColor(hex) ?? defaultTextColor
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
    a: 1,
  }
}

function hsvToHex(color: HsvColor) {
  const hue = ((color.h % 360) + 360) % 360
  const saturation = clampRatio(color.s)
  const value = clampRatio(color.v)
  const chroma = value * saturation
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const match = value - chroma
  const [red, green, blue] =
    hue < 60 ? [chroma, x, 0]
      : hue < 120 ? [x, chroma, 0]
        : hue < 180 ? [0, chroma, x]
          : hue < 240 ? [0, x, chroma]
            : hue < 300 ? [x, 0, chroma]
              : [chroma, 0, x]
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

const getEditorTopVisibleLine = (view: EditorView) => {
  const rect = view.scrollDOM.getBoundingClientRect()
  const pos = view.posAtCoords({
    x: rect.left + EDITOR_SCROLL_ANCHOR_Y_OFFSET,
    y: rect.top + EDITOR_SCROLL_ANCHOR_Y_OFFSET,
  })

  if (pos == null) return view.state.doc.lineAt(view.state.selection.main.head).number
  return view.state.doc.lineAt(pos).number
}

const getPreviewPosition = (view: EditorView, source: PreviewSyncPosition['source']): PreviewSyncPosition => {
  const scrollDom = view.scrollDOM
  const maxScrollTop = scrollDom.scrollHeight - scrollDom.clientHeight
  const fallbackRatio = maxScrollTop > 0 ? clampRatio(scrollDom.scrollTop / maxScrollTop) : 0
  return {
    line:
      source === 'scroll'
        ? getEditorTopVisibleLine(view)
        : view.state.doc.lineAt(view.state.selection.main.head).number,
    source,
    fallbackRatio,
    immediate: source === 'cursor',
  }
}

export function MarkdownEditor({
  value,
  onChange,
  onPreviewSyncPositionChange,
  onEditorViewChange,
  onToolbarHeightChange,
  onContentEdit,
  onSaveShortcut,
  insertRequest,
  onInsertConsumed,
  onPasteImages,
}: MarkdownEditorProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const { resolvedMode } = useAppTheme()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [localValue, setLocalValue] = useState(value)
  const [lastTextColor, setLastTextColor] = useState(defaultTextColor)
  const [draftTextColor, setDraftTextColor] = useState(defaultTextColor)
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false)
  const localValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const composingRef = useRef(false)
  const compositionFrameRef = useRef<number | undefined>(undefined)
  const onPreviewSyncPositionChangeRef = useRef(onPreviewSyncPositionChange)
  const onEditorViewChangeRef = useRef(onEditorViewChange)
  const onToolbarHeightChangeRef = useRef(onToolbarHeightChange)
  const onContentEditRef = useRef(onContentEdit)
  const onSaveShortcutRef = useRef(onSaveShortcut)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onPreviewSyncPositionChangeRef.current = onPreviewSyncPositionChange
  }, [onPreviewSyncPositionChange])

  useEffect(() => {
    onEditorViewChangeRef.current = onEditorViewChange
  }, [onEditorViewChange])

  useEffect(() => {
    onToolbarHeightChangeRef.current = onToolbarHeightChange
  }, [onToolbarHeightChange])

  useEffect(() => {
    onContentEditRef.current = onContentEdit
  }, [onContentEdit])

  useEffect(() => {
    onSaveShortcutRef.current = onSaveShortcut
  }, [onSaveShortcut])

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return undefined

    const reportToolbarHeight = () => onToolbarHeightChangeRef.current?.(toolbar.getBoundingClientRect().height)
    reportToolbarHeight()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', reportToolbarHeight)
      return () => window.removeEventListener('resize', reportToolbarHeight)
    }

    const observer = new ResizeObserver(reportToolbarHeight)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (composingRef.current || value === localValueRef.current) return
    localValueRef.current = value
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(compositionFrameRef.current ?? 0)
      onEditorViewChangeRef.current?.(null)
    }
  }, [])

  const emitPreviewSyncPosition = useCallback((view: EditorView, source: PreviewSyncPosition['source']) => {
    onPreviewSyncPositionChangeRef.current?.(getPreviewPosition(view, source))
  }, [])

  const emitChange = useCallback((nextValue: string) => {
    localValueRef.current = nextValue
    setLocalValue(nextValue)
    onChangeRef.current(nextValue)
  }, [])

  const dispatchCurrentValue = useCallback((view: EditorView) => {
    onContentEditRef.current?.(view.state.doc.lineAt(view.state.selection.main.head).number)
    emitChange(view.state.doc.toString())
    view.focus()
  }, [emitChange])

  const wrapSelection = useCallback((view: EditorView, before: string, after: string, fallback = 'text') => {
    const selection = view.state.selection.main
    const selected = view.state.doc.sliceString(selection.from, selection.to)
    if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
      const insert = selected.slice(before.length, selected.length - after.length)
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert },
        selection: { anchor: selection.from, head: selection.from + insert.length },
        scrollIntoView: true,
      })
      dispatchCurrentValue(view)
      return
    }
    if (selected) {
      const beforeFrom = selection.from - before.length
      const afterTo = selection.to + after.length
      const hasWrappedContext =
        beforeFrom >= 0 &&
        afterTo <= view.state.doc.length &&
        view.state.doc.sliceString(beforeFrom, selection.from) === before &&
        view.state.doc.sliceString(selection.to, afterTo) === after
      if (hasWrappedContext) {
        view.dispatch({
          changes: [
            { from: selection.to, to: afterTo, insert: '' },
            { from: beforeFrom, to: selection.from, insert: '' },
          ],
          selection: { anchor: beforeFrom, head: beforeFrom + selected.length },
          scrollIntoView: true,
        })
        dispatchCurrentValue(view)
        return
      }
    }
    const text = selected || fallback
    const insert = `${before}${text}${after}`
    const fallbackFrom = selection.from + before.length
    const fallbackTo = fallbackFrom + fallback.length
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: selected ? { anchor: selection.from, head: selection.from + insert.length } : { anchor: fallbackFrom, head: fallbackTo },
      scrollIntoView: true,
    })
    dispatchCurrentValue(view)
  }, [dispatchCurrentValue])

  const wrapColorSelection = useCallback((view: EditorView, color: string) => {
    const selection = view.state.selection.main
    const selected = view.state.doc.sliceString(selection.from, selection.to)
    const exactColorSpan = selected.match(/^<span style="color: #[0-9a-f]{6}">([\s\S]*)<\/span>$/i)
    if (exactColorSpan) {
      const insert = exactColorSpan[1]
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert },
        selection: { anchor: selection.from, head: selection.from + insert.length },
        scrollIntoView: true,
      })
      dispatchCurrentValue(view)
      return
    }

    const openingSpanPattern = /<span style="color: #[0-9a-f]{6}">$/i
    const beforeStart = Math.max(0, selection.from - '<span style="color: #000000">'.length)
    const beforeText = view.state.doc.sliceString(beforeStart, selection.from)
    const openingMatch = beforeText.match(openingSpanPattern)
    const afterText = view.state.doc.sliceString(selection.to, selection.to + '</span>'.length)
    if (selected && openingMatch && afterText === '</span>') {
      const beforeFrom = selection.from - openingMatch[0].length
      view.dispatch({
        changes: [
          { from: selection.to, to: selection.to + '</span>'.length, insert: '' },
          { from: beforeFrom, to: selection.from, insert: '' },
        ],
        selection: { anchor: beforeFrom, head: beforeFrom + selected.length },
        scrollIntoView: true,
      })
      dispatchCurrentValue(view)
      return
    }

    wrapSelection(view, `<span style="color: ${color}">`, '</span>')
  }, [dispatchCurrentValue, wrapSelection])

  const insertCodeBlock = useCallback((view: EditorView) => {
    const selection = view.state.selection.main
    const selected = view.state.doc.sliceString(selection.from, selection.to)
    const insert = selected ? `\`\`\`\n${selected}\n\`\`\`` : `\`\`\`\n\n\`\`\``
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: selection.from + 3 },
      scrollIntoView: true,
    })
    dispatchCurrentValue(view)
  }, [dispatchCurrentValue])

  const insertQuote = useCallback((view: EditorView) => {
    const selection = view.state.selection.main
    if (selection.empty) {
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: '> ' },
        selection: { anchor: selection.from + 2 },
        scrollIntoView: true,
      })
      dispatchCurrentValue(view)
      return
    }

    const doc = view.state.doc
    const endPosition = selection.to > selection.from && doc.lineAt(selection.to).from === selection.to ? selection.to - 1 : selection.to
    const startLine = doc.lineAt(selection.from)
    const endLine = doc.lineAt(endPosition)
    const lines = []
    for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
      const line = doc.line(lineNumber)
      lines.push(line.text ? `> ${line.text}` : '>')
    }
    const insert = lines.join('\n')
    view.dispatch({
      changes: { from: startLine.from, to: endLine.to, insert },
      selection: { anchor: startLine.from, head: startLine.from + insert.length },
      scrollIntoView: true,
    })
    dispatchCurrentValue(view)
  }, [dispatchCurrentValue])

  const insertBreak = useCallback((view: EditorView) => {
    const selection = view.state.selection.main
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: '<br>\n' },
      selection: { anchor: selection.from + 5 },
      scrollIntoView: true,
    })
    dispatchCurrentValue(view)
  }, [dispatchCurrentValue])

  const replaceSelectionInView = useCallback((view: EditorView, action: FormatAction, color = lastTextColor) => {
    if (action === 'bold') wrapSelection(view, '**', '**')
    else if (action === 'italic') wrapSelection(view, '*', '*')
    else if (action === 'link') wrapSelection(view, '[', '](url)')
    else if (action === 'underline') wrapSelection(view, '<u>', '</u>')
    else if (action === 'highlight') wrapSelection(view, '==', '==')
    else if (action === 'inlineCode') wrapSelection(view, '`', '`')
    else if (action === 'strikethrough') wrapSelection(view, '~~', '~~')
    else if (action === 'color') wrapColorSelection(view, color)
    else if (action === 'codeBlock') insertCodeBlock(view)
    else if (action === 'quote') insertQuote(view)
  }, [insertCodeBlock, insertQuote, lastTextColor, wrapColorSelection, wrapSelection])

  const runEditorCommand = useCallback((view: EditorView, command: (target: EditorView) => boolean) => {
    const handled = command(view)
    if (handled) view.focus()
    return handled
  }, [])

  const runSaveShortcut = useCallback(() => {
    if (!onSaveShortcutRef.current) return false
    onSaveShortcutRef.current()
    return true
  }, [])

  const markdownExtension = useMemo(() => markdown(), [])

  const basicSetup = useMemo(
    () => ({
      foldGutter: true,
      highlightActiveLine: true,
      highlightActiveLineGutter: true,
      lineNumbers: true,
    }),
    [],
  )

  const replaceSelection = useCallback((action: FormatAction, color?: string) => {
    if (!editorView) return
    replaceSelectionInView(editorView, action, color)
  }, [editorView, replaceSelectionInView])

  const applyTextColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color)
    if (!normalized) return
    setLastTextColor(normalized)
    setDraftTextColor(normalized)
    replaceSelection('color', normalized)
  }, [replaceSelection])

  const editorKeymap = useMemo(
    () =>
      // CodeMirror calls these commands on editor key events, not during React render.
      // eslint-disable-next-line react-hooks/refs
      keymap.of([
        { key: 'Mod-b', run: (view) => { replaceSelectionInView(view, 'bold'); return true } },
        { key: 'Mod-i', run: (view) => { replaceSelectionInView(view, 'italic'); return true } },
        { key: 'Mod-u', run: (view) => { replaceSelectionInView(view, 'underline'); return true } },
        { key: 'Mod-h', run: (view) => { replaceSelectionInView(view, 'highlight'); return true } },
        { key: 'Mod-k', run: (view) => { replaceSelectionInView(view, 'link'); return true } },
        { key: 'Mod-Shift-c', run: (view) => { replaceSelectionInView(view, 'inlineCode'); return true } },
        { key: 'Mod-e', run: (view) => { replaceSelectionInView(view, 'quote'); return true } },
        { key: 'Mod-d', run: (view) => runEditorCommand(view, copyLineDown) },
        { key: 'Mod-s', run: () => runSaveShortcut() },
        { key: 'Mod-y', run: (view) => runEditorCommand(view, deleteLine) },
        { key: 'Mod-l', run: (view) => runEditorCommand(view, deleteLine) },
        { key: 'Mod-z', run: (view) => runEditorCommand(view, undo) },
        { key: 'Mod-Shift-z', run: (view) => runEditorCommand(view, redo) },
        { key: 'Shift-Enter', run: (view) => { insertBreak(view); return true } },
      ]),
    [insertBreak, replaceSelectionInView, runEditorCommand, runSaveShortcut],
  )

  const editorExtensions = useMemo(
    () => [
      markdownExtension,
      EditorView.lineWrapping,
      editorKeymap,
    ],
    [editorKeymap, markdownExtension],
  )

  useEffect(() => {
    if (!editorView) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const editorHasFocus = editorView.hasFocus || editorView.dom.contains(document.activeElement)
      if (!editorHasFocus) return

      const runFormat = (action: FormatAction) => {
        event.preventDefault()
        event.stopPropagation()
        replaceSelectionInView(editorView, action)
      }
      const runCommand = (command: (target: EditorView) => boolean) => {
        event.preventDefault()
        event.stopPropagation()
        runEditorCommand(editorView, command)
      }
      const saveShortcut = () => {
        if (!onSaveShortcutRef.current) return
        event.preventDefault()
        event.stopPropagation()
        runSaveShortcut()
      }

      if (event.key === 'Enter' && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        event.stopPropagation()
        insertBreak(editorView)
        return
      }

      if (!isShortcutModifierPressed(event) || event.altKey) return
      if (key === 'z' && event.shiftKey) runCommand(redo)
      else if (key === 'z' && !event.shiftKey) runCommand(undo)
      else if (key === 's' && !event.shiftKey) saveShortcut()
      else if ((key === 'y' || key === 'l') && !event.shiftKey) runCommand(deleteLine)
      else if (key === 'd' && !event.shiftKey) runCommand(copyLineDown)
      else if (key === 'b') runFormat('bold')
      else if (key === 'i') runFormat('italic')
      else if (key === 'u') runFormat('underline')
      else if (key === 'h') runFormat('highlight')
      else if (key === 'e') runFormat('quote')
      else if (key === 'k') runFormat('link')
      else if (key === 'c' && event.shiftKey) runFormat('inlineCode')
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [editorView, insertBreak, replaceSelectionInView, runEditorCommand, runSaveShortcut])

  const runToolbarCommand = (command: (target: EditorView) => boolean) => {
    if (!editorView) return
    runEditorCommand(editorView, command)
  }

  useEffect(() => {
    if (!editorView || !insertRequest) return undefined
    const selection = editorView.state.selection.main
    editorView.dispatch({
      changes: { from: selection.from, to: selection.to, insert: insertRequest.text },
      selection: { anchor: selection.from + insertRequest.text.length },
      scrollIntoView: true,
    })
    editorView.focus()
    const frame = window.requestAnimationFrame(() => {
      emitChange(editorView.state.doc.toString())
      onInsertConsumed?.(insertRequest.id)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editorView, emitChange, insertRequest, onInsertConsumed])

  useEffect(() => {
    if (!editorView) return undefined
    const handleCompositionStart = () => {
      composingRef.current = true
      window.cancelAnimationFrame(compositionFrameRef.current ?? 0)
    }
    const handleCompositionEnd = () => {
      composingRef.current = false
      compositionFrameRef.current = window.requestAnimationFrame(() => {
        onContentEditRef.current?.(editorView.state.doc.lineAt(editorView.state.selection.main.head).number)
        emitChange(editorView.state.doc.toString())
      })
    }
    editorView.dom.addEventListener('compositionstart', handleCompositionStart)
    editorView.dom.addEventListener('compositionend', handleCompositionEnd)
    return () => {
      editorView.dom.removeEventListener('compositionstart', handleCompositionStart)
      editorView.dom.removeEventListener('compositionend', handleCompositionEnd)
    }
  }, [editorView, emitChange])

  useEffect(() => {
    if (!editorView || !onPasteImages) return undefined
    const handlePaste = (event: ClipboardEvent) => {
      const files = extractImageFilesFromPasteEvent(event)
      if (files.length === 0) return
      event.preventDefault()
      onPasteImages(files)
    }
    editorView.dom.addEventListener('paste', handlePaste)
    return () => editorView.dom.removeEventListener('paste', handlePaste)
  }, [editorView, onPasteImages])

  const handleUpdate = (update: ViewUpdate) => {
    if (!onPreviewSyncPositionChange || update.docChanged || !update.selectionSet) return
    emitPreviewSyncPosition(update.view, 'cursor')
  }

  const handleChange = (nextValue: string, update: ViewUpdate) => {
    localValueRef.current = nextValue
    setLocalValue(nextValue)
    if (!composingRef.current) {
      const line = update.state.doc.lineAt(update.state.selection.main.head).number
      onContentEditRef.current?.(line)
      onChangeRef.current(nextValue)
    }
  }

  const normalizedDraftTextColor = normalizeHexColor(draftTextColor)
  const colorError = draftTextColor.trim() && !normalizedDraftTextColor ? t('editor.invalidHexColor') : undefined
  const pickerColor = hexToHsv(normalizedDraftTextColor ?? lastTextColor)

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar} ref={toolbarRef}>
        <ToolbarButton label={t('editor.undo')} shortcut={formatShortcut('Z')} icon={<ArrowUndoRegular />} onClick={() => runToolbarCommand(undo)} />
        <ToolbarButton label={t('editor.redo')} shortcut={formatShortcut('Shift + Z')} icon={<ArrowRedoRegular />} onClick={() => runToolbarCommand(redo)} />
        <ToolbarButton label={t('editor.bold')} shortcut={formatShortcut('B')} icon={<TextBoldRegular />} onClick={() => replaceSelection('bold')} />
        <ToolbarButton label={t('editor.italic')} shortcut={formatShortcut('I')} icon={<TextItalicRegular />} onClick={() => replaceSelection('italic')} />
        <ToolbarButton label={t('editor.underline')} shortcut={formatShortcut('U')} icon={<TextUnderlineRegular />} onClick={() => replaceSelection('underline')} />
        <ToolbarButton label={t('editor.strikethrough')} icon={<TextStrikethroughRegular />} onClick={() => replaceSelection('strikethrough')} />
        <ToolbarButton label={t('editor.inlineCode')} shortcut={formatShortcut('Shift + C')} icon={<CodeRegular />} onClick={() => replaceSelection('inlineCode')} />
        <ToolbarButton label={t('editor.codeBlock')} icon={<CodeBlockRegular />} onClick={() => replaceSelection('codeBlock')} />
        <ToolbarButton label={t('editor.quote')} shortcut={formatShortcut('E')} icon={<TextQuoteRegular />} onClick={() => replaceSelection('quote')} />
        <ToolbarButton label={t('editor.link')} shortcut={formatShortcut('K')} icon={<LinkRegular />} onClick={() => replaceSelection('link')} />
        <ToolbarButton label={t('editor.highlight')} shortcut={formatShortcut('H')} icon={<HighlightRegular />} onClick={() => replaceSelection('highlight')} />
        <div className={styles.splitButtonGroup}>
          <ToolbarButton label={t('editor.textColor')} icon={<span className={styles.textColorGlyph}>A</span>} indicatorColor={lastTextColor} onClick={() => applyTextColor(lastTextColor)} />
          <Popover
            open={colorPopoverOpen}
            onOpenChange={(_, data) => {
              setColorPopoverOpen(data.open)
              if (data.open) setDraftTextColor(lastTextColor)
            }}
            positioning="below-start"
          >
            <PopoverTrigger disableButtonEnhancement>
              <span>
                <ToolbarButton label={t('editor.pickTextColor')} icon={<ChevronDownRegular />} onClick={() => undefined} />
              </span>
            </PopoverTrigger>
            <PopoverSurface className={styles.colorPopover}>
              <ColorPicker
                color={pickerColor}
                onColorChange={(_, data) => setDraftTextColor(hsvToHex(data.color))}
              >
                <div className={styles.colorPicker}>
                  <ColorArea className={styles.colorArea} />
                  <ColorSlider className={styles.colorSlider} />
                </div>
              </ColorPicker>
              <Field
                label={t('editor.hexColor')}
                validationState={colorError ? 'error' : 'none'}
                validationMessage={colorError}
              >
                <Input value={draftTextColor} onChange={(_, data) => setDraftTextColor(data.value)} />
              </Field>
              <div className={styles.colorActions}>
                <Button
                  appearance="primary"
                  disabled={!normalizedDraftTextColor}
                  onClick={() => {
                    if (!normalizedDraftTextColor) return
                    applyTextColor(normalizedDraftTextColor)
                    setColorPopoverOpen(false)
                  }}
                >
                  {t('editor.applyColor')}
                </Button>
              </div>
            </PopoverSurface>
          </Popover>
        </div>
      </div>
      <CodeMirror
        className={styles.root}
        value={localValue}
        height="560px"
        theme={resolvedMode}
        extensions={editorExtensions}
        onChange={handleChange}
        onCreateEditor={(view) => {
          setEditorView(view)
          onEditorViewChangeRef.current?.(view)
        }}
        onUpdate={handleUpdate}
        basicSetup={basicSetup}
      />
    </div>
  )
}

function ToolbarButton({
  label,
  shortcut,
  icon,
  indicatorColor,
  onClick,
}: {
  label: string
  shortcut?: string
  icon: JSX.Element
  indicatorColor?: string
  onClick: () => void
}) {
  const styles = useStyles()
  const tooltip = buildTooltip(label, shortcut)
  const buttonIcon = indicatorColor ? (
    <span className={styles.iconWithIndicator}>
      {icon}
      <span className={styles.colorIndicator} style={{ backgroundColor: indicatorColor }} />
    </span>
  ) : icon
  return (
    <Tooltip content={tooltip} relationship="label">
      <Button appearance="subtle" icon={buttonIcon} onClick={onClick} aria-label={tooltip} />
    </Tooltip>
  )
}
