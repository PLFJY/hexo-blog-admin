import { makeStyles, tokens } from '@fluentui/react-components'
import type { ReactNode } from 'react'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    lineHeight: tokens.lineHeightBase400,
    '& h1': { margin: 0 },
    '& h2': { margin: 0 },
    '& h3': { margin: 0 },
    '& p': { margin: 0 },
    '& pre': {
      overflowX: 'auto',
      padding: tokens.spacingVerticalM,
      borderRadius: tokens.borderRadiusMedium,
      backgroundColor: tokens.colorNeutralBackground3,
    },
    '& code': {
      fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    },
    '& mark': {
      padding: '0 3px',
      borderRadius: tokens.borderRadiusSmall,
      color: tokens.colorNeutralForegroundInverted,
      backgroundColor: tokens.colorPaletteYellowForeground1,
    },
    '& blockquote': {
      margin: 0,
      paddingLeft: tokens.spacingHorizontalM,
      borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
      color: tokens.colorNeutralForeground2,
    },
    '& img': {
      maxWidth: '100%',
      borderRadius: tokens.borderRadiusMedium,
    },
  },
})

type MarkdownPreviewProps = {
  markdown: string
  resolveImageSrc?: (src: string) => string
}

const inlinePattern = /(`[^`]+`|!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|==[^=]+==|\*\*[^*]+\*\*|\*[^*]+\*)/g

function renderInline(text: string, resolveImageSrc?: (src: string) => string): ReactNode[] {
  return text.split(inlinePattern).filter(Boolean).map((part, index) => {
    if (part.startsWith('==') && part.endsWith('==')) {
      return <mark key={index}>{part.slice(2, -2)}</mark>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('![')) {
      const match = /^!\[([^\]]*)]\(([^)]+)\)$/.exec(part)
      return match ? <img key={index} alt={match[1]} src={resolveImageSrc?.(match[2]) ?? match[2]} /> : part
    }
    if (part.startsWith('[')) {
      const match = /^\[([^\]]+)]\(([^)]+)\)$/.exec(part)
      return match ? <a key={index} href={match[2]} target="_blank" rel="noreferrer">{match[1]}</a> : part
    }
    return part
  })
}

export function MarkdownPreview({ markdown, resolveImageSrc }: MarkdownPreviewProps) {
  const styles = useStyles()
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let code: string[] | null = null

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraph.join(' '), resolveImageSrc)}</p>)
      paragraph = []
    }
  }
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {list.map((item, index) => <li key={index}>{renderInline(item, resolveImageSrc)}</li>)}
        </ul>,
      )
      list = []
    }
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (code) {
        blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join('\n')}</code></pre>)
        code = null
      } else {
        flushParagraph()
        flushList()
        code = []
      }
      continue
    }
    if (code) {
      code.push(line)
      continue
    }
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length
      const content = renderInline(heading[2], resolveImageSrc)
      blocks.push(level === 1 ? <h1 key={blocks.length}>{content}</h1> : level === 2 ? <h2 key={blocks.length}>{content}</h2> : <h3 key={blocks.length}>{content}</h3>)
      continue
    }
    const item = /^[-*]\s+(.+)$/.exec(line)
    if (item) {
      flushParagraph()
      list.push(item[1])
      continue
    }
    if (line.startsWith('> ')) {
      flushParagraph()
      flushList()
      blocks.push(<blockquote key={blocks.length}>{renderInline(line.slice(2), resolveImageSrc)}</blockquote>)
      continue
    }
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  if (code) blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join('\n')}</code></pre>)

  return <div className={styles.root}>{blocks}</div>
}
