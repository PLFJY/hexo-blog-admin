import { markdown } from '@codemirror/lang-markdown'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView, type ViewUpdate } from '@uiw/react-codemirror'
import { Button, Tooltip, makeStyles, tokens } from '@fluentui/react-components'
import {
  ArrowRedoRegular,
  ArrowUndoRegular,
  HighlightRegular,
  LinkRegular,
  TextBoldRegular,
  TextItalicRegular,
  TextUnderlineRegular,
} from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
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
  onScrollRatioChange?: (position: PreviewSyncPosition) => void
  insertRequest?: { id: number; text: string }
  onInsertConsumed?: (id: number) => void
  onPasteImages?: (files: File[]) => void
}

type FormatAction = 'bold' | 'italic' | 'link' | 'underline' | 'highlight'
export type PreviewSyncPosition = {
  ratio: number
  line: number
  source: 'scroll' | 'cursor'
}

const clampRatio = (ratio: number) => Math.max(0, Math.min(1, ratio))

const getPreviewPosition = (view: EditorView, source: PreviewSyncPosition['source']): PreviewSyncPosition => {
  const scrollDom = view.scrollDOM
  const maxScrollTop = scrollDom.scrollHeight - scrollDom.clientHeight
  const lineCount = view.state.doc.lines
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const fallbackRatio = lineCount <= 1 ? 0 : (line.number - 1) / (lineCount - 1)
  return {
    ratio: maxScrollTop > 0 ? clampRatio(scrollDom.scrollTop / maxScrollTop) : clampRatio(fallbackRatio),
    line: line.number,
    source,
  }
}

export function MarkdownEditor({
  value,
  onChange,
  onScrollRatioChange,
  insertRequest,
  onInsertConsumed,
  onPasteImages,
}: MarkdownEditorProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const { resolvedMode } = useAppTheme()
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [localValue, setLocalValue] = useState(value)
  const localValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const composingRef = useRef(false)
  const compositionFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (composingRef.current || value === localValueRef.current) return
    localValueRef.current = value
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    return () => window.cancelAnimationFrame(compositionFrameRef.current ?? 0)
  }, [])

  const emitChange = (nextValue: string) => {
    localValueRef.current = nextValue
    setLocalValue(nextValue)
    onChangeRef.current(nextValue)
  }

  const dispatchCurrentValue = (view: EditorView) => {
    emitChange(view.state.doc.toString())
    view.focus()
  }

  const replaceSelection = (action: FormatAction) => {
    if (!editorView) return
    const selection = editorView.state.selection.main
    const selected = editorView.state.doc.sliceString(selection.from, selection.to)
    const fallback = action === 'link' ? 'text' : 'text'
    const text = selected || fallback
    const insert =
      action === 'bold'
        ? `**${text}**`
        : action === 'italic'
          ? `*${text}*`
          : action === 'link'
            ? `[${text}](url)`
            : action === 'underline'
              ? `<u>${text}</u>`
              : `==${text}==`
    editorView.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: selection.from + insert.length },
      scrollIntoView: true,
    })
    dispatchCurrentValue(editorView)
  }

  const runNativeHistory = (command: 'undo' | 'redo') => {
    if (!editorView) return
    editorView.focus()
    document.execCommand(command)
  }

  useEffect(() => {
    if (!editorView || !onScrollRatioChange) return undefined
    const scrollDom = editorView.scrollDOM
    const handleScroll = () => onScrollRatioChange(getPreviewPosition(editorView, 'scroll'))
    scrollDom.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => scrollDom.removeEventListener('scroll', handleScroll)
  }, [editorView, onScrollRatioChange])

  useEffect(() => {
    if (!editorView || !insertRequest) return
    const selection = editorView.state.selection.main
    editorView.dispatch({
      changes: { from: selection.from, to: selection.to, insert: insertRequest.text },
      selection: { anchor: selection.from + insertRequest.text.length },
      scrollIntoView: true,
    })
    editorView.focus()
    emitChange(editorView.state.doc.toString())
    onInsertConsumed?.(insertRequest.id)
  }, [editorView, insertRequest, onChange, onInsertConsumed])

  useEffect(() => {
    if (!editorView) return undefined
    const handleCompositionStart = () => {
      composingRef.current = true
      window.cancelAnimationFrame(compositionFrameRef.current ?? 0)
    }
    const handleCompositionEnd = () => {
      composingRef.current = false
      compositionFrameRef.current = window.requestAnimationFrame(() => {
        emitChange(editorView.state.doc.toString())
      })
    }
    editorView.dom.addEventListener('compositionstart', handleCompositionStart)
    editorView.dom.addEventListener('compositionend', handleCompositionEnd)
    return () => {
      editorView.dom.removeEventListener('compositionstart', handleCompositionStart)
      editorView.dom.removeEventListener('compositionend', handleCompositionEnd)
    }
  }, [editorView])

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
    if (!onScrollRatioChange || (!update.scrollChanged && !update.docChanged && !update.selectionSet)) return
    onScrollRatioChange(getPreviewPosition(update.view, update.docChanged || update.selectionSet ? 'cursor' : 'scroll'))
  }

  const handleChange = (nextValue: string) => {
    localValueRef.current = nextValue
    setLocalValue(nextValue)
    if (!composingRef.current) onChangeRef.current(nextValue)
  }

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <ToolbarButton label={t('editor.undo')} icon={<ArrowUndoRegular />} onClick={() => runNativeHistory('undo')} />
        <ToolbarButton label={t('editor.redo')} icon={<ArrowRedoRegular />} onClick={() => runNativeHistory('redo')} />
        <ToolbarButton label={t('editor.bold')} icon={<TextBoldRegular />} onClick={() => replaceSelection('bold')} />
        <ToolbarButton label={t('editor.italic')} icon={<TextItalicRegular />} onClick={() => replaceSelection('italic')} />
        <ToolbarButton label={t('editor.link')} icon={<LinkRegular />} onClick={() => replaceSelection('link')} />
        <ToolbarButton label={t('editor.underline')} icon={<TextUnderlineRegular />} onClick={() => replaceSelection('underline')} />
        <ToolbarButton label={t('editor.highlight')} icon={<HighlightRegular />} onClick={() => replaceSelection('highlight')} />
      </div>
      <CodeMirror
        className={styles.root}
        value={localValue}
        height="560px"
        theme={resolvedMode}
        extensions={[
          markdown(),
          EditorView.lineWrapping
        ]}
        onChange={handleChange}
        onCreateEditor={(view) => setEditorView(view)}
        onUpdate={handleUpdate}
        basicSetup={{
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          lineNumbers: true
        }}
      />
    </div>
  )
}

function ToolbarButton({ label, icon, onClick }: { label: string; icon: JSX.Element; onClick: () => void }) {
  return (
    <Tooltip content={label} relationship="label">
      <Button appearance="subtle" icon={icon} onClick={onClick} aria-label={label} />
    </Tooltip>
  )
}
