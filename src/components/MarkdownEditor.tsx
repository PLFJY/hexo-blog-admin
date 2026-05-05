import { markdown } from '@codemirror/lang-markdown'
import CodeMirror from '@uiw/react-codemirror'
import type { EditorView, ViewUpdate } from '@uiw/react-codemirror'
import { makeStyles, tokens } from '@fluentui/react-components'
import { useEffect, useState } from 'react'
import { useAppTheme } from '../app/ThemeProvider'

const useStyles = makeStyles({
  root: {
    minHeight: '560px',
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    '& .cm-editor': {
      minHeight: '560px',
      fontSize: '14px',
    },
    '& .cm-scroller': {
      minHeight: '560px',
      maxHeight: '72vh',
      overflow: 'auto',
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
  onScrollRatioChange?: (ratio: number) => void
}

export function MarkdownEditor({ value, onChange, onScrollRatioChange }: MarkdownEditorProps) {
  const styles = useStyles()
  const { resolvedMode } = useAppTheme()
  const [editorView, setEditorView] = useState<EditorView | null>(null)

  useEffect(() => {
    if (!editorView || !onScrollRatioChange) return undefined
    const scrollDom = editorView.scrollDOM
    const handleScroll = () => {
      const maxScrollTop = scrollDom.scrollHeight - scrollDom.clientHeight
      onScrollRatioChange(maxScrollTop > 0 ? scrollDom.scrollTop / maxScrollTop : 0)
    }
    scrollDom.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => scrollDom.removeEventListener('scroll', handleScroll)
  }, [editorView, onScrollRatioChange])

  const handleUpdate = (update: ViewUpdate) => {
    if (!onScrollRatioChange || !update.scrollChanged) return
    const scrollDom = update.view.scrollDOM
    const maxScrollTop = scrollDom.scrollHeight - scrollDom.clientHeight
    onScrollRatioChange(maxScrollTop > 0 ? scrollDom.scrollTop / maxScrollTop : 0)
  }

  return (
    <CodeMirror
      className={styles.root}
      value={value}
      minHeight="560px"
      maxHeight="72vh"
      theme={resolvedMode}
      extensions={[markdown()]}
      onChange={onChange}
      onCreateEditor={(view) => setEditorView(view)}
      onUpdate={handleUpdate}
      basicSetup={{
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        lineNumbers: true,
      }}
    />
  )
}
