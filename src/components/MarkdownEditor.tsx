import { markdown } from '@codemirror/lang-markdown'
import CodeMirror from '@uiw/react-codemirror'
import { makeStyles, tokens } from '@fluentui/react-components'
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
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const styles = useStyles()
  const { resolvedMode } = useAppTheme()

  return (
    <CodeMirror
      className={styles.root}
      value={value}
      minHeight="560px"
      maxHeight="72vh"
      theme={resolvedMode}
      extensions={[markdown()]}
      onChange={onChange}
      basicSetup={{
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        lineNumbers: true,
      }}
    />
  )
}
