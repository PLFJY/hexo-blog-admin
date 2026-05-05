import MarkdownIt from 'markdown-it'
import markdownItAbbr from 'markdown-it-abbr'
import markdownItDeflist from 'markdown-it-deflist'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItKatex from 'markdown-it-katex'
import markdownItMark from 'markdown-it-mark'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import { makeStyles, tokens } from '@fluentui/react-components'
import { useEffect, useMemo, useRef } from 'react'
import 'katex/dist/katex.min.css'
import { extractFrontMatterTitle, stripFrontMatter } from '../shared/frontMatter'

const useStyles = makeStyles({
  root: {
    height: '560px',
    minWidth: 0,
    overflow: 'auto',
    boxSizing: 'border-box',
    padding: tokens.spacingVerticalXL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase400,
    '& > :first-child': {
      marginTop: 0,
    },
    '& > :last-child': {
      marginBottom: 0,
    },
    '& h1': {
      margin: `0 0 ${tokens.spacingVerticalL}`,
      fontSize: '28px',
      lineHeight: '36px',
      fontWeight: tokens.fontWeightSemibold,
      letterSpacing: 0,
      overflowWrap: 'anywhere',
    },
    '& h2': {
      margin: `${tokens.spacingVerticalXL} 0 ${tokens.spacingVerticalM}`,
      fontSize: '22px',
      lineHeight: '30px',
      fontWeight: tokens.fontWeightSemibold,
      letterSpacing: 0,
      overflowWrap: 'anywhere',
    },
    '& h3': {
      margin: `${tokens.spacingVerticalL} 0 ${tokens.spacingVerticalS}`,
      fontSize: '18px',
      lineHeight: '26px',
      fontWeight: tokens.fontWeightSemibold,
      letterSpacing: 0,
      overflowWrap: 'anywhere',
    },
    '& p, & li': {
      overflowWrap: 'anywhere',
    },
    '& a': {
      color: tokens.colorBrandForegroundLink,
    },
    '& blockquote': {
      marginLeft: 0,
      marginRight: 0,
      paddingLeft: tokens.spacingHorizontalM,
      borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
      color: tokens.colorNeutralForeground2,
    },
    '& code': {
      fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    },
    '& :not(pre) > code': {
      padding: '2px 4px',
      borderRadius: tokens.borderRadiusSmall,
      backgroundColor: tokens.colorNeutralBackground3,
    },
    '& pre': {
      overflowX: 'auto',
      padding: tokens.spacingVerticalM,
      borderRadius: tokens.borderRadiusMedium,
      backgroundColor: tokens.colorNeutralBackground3,
    },
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
      overflow: 'auto',
    },
    '& th, & td': {
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      verticalAlign: 'top',
    },
    '& th': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
    '& img': {
      maxWidth: '100%',
      borderRadius: tokens.borderRadiusMedium,
    },
    '& mark': {
      padding: '0 3px',
      borderRadius: tokens.borderRadiusSmall,
      color: tokens.colorNeutralForegroundInverted,
      backgroundColor: tokens.colorPaletteYellowForeground1,
    },
    '& .katex-display': {
      overflowX: 'auto',
      overflowY: 'hidden',
      padding: `${tokens.spacingVerticalS} 0`,
    },
  },
})

type MarkdownPreviewProps = {
  markdown: string
  resolveResourceUrl?: (src: string) => string
  scrollRatio?: number
}

function createMarkdownRenderer(resolveResourceUrl?: (src: string) => string) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  })
    .use(markdownItAbbr)
    .use(markdownItDeflist)
    .use(markdownItFootnote)
    .use(markdownItKatex)
    .use(markdownItMark)
    .use(markdownItSub)
    .use(markdownItSup)

  const defaultImageRenderer = md.renderer.rules.image
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const src = token.attrGet('src')
    if (src) token.attrSet('src', resolveResourceUrl?.(src) ?? src)
    return defaultImageRenderer ? defaultImageRenderer(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
  }

  const defaultLinkOpenRenderer = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const href = token.attrGet('href')
    if (href) token.attrSet('href', resolveResourceUrl?.(href) ?? href)
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noreferrer')
    return defaultLinkOpenRenderer ? defaultLinkOpenRenderer(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
  }

  return md
}

export function MarkdownPreview({ markdown, resolveResourceUrl, scrollRatio }: MarkdownPreviewProps) {
  const styles = useStyles()
  const rootRef = useRef<HTMLDivElement>(null)
  const renderer = useMemo(() => createMarkdownRenderer(resolveResourceUrl), [resolveResourceUrl])
  const html = useMemo(() => {
    const title = extractFrontMatterTitle(markdown)
    const body = stripFrontMatter(markdown)
    return renderer.render(`${title ? `# ${title}\n\n` : ''}${body}`)
  }, [markdown, renderer])

  useEffect(() => {
    if (scrollRatio === undefined || !rootRef.current) return
    const element = rootRef.current
    const maxScrollTop = element.scrollHeight - element.clientHeight
    element.scrollTop = maxScrollTop > 0 ? maxScrollTop * scrollRatio : 0
  }, [scrollRatio, html])

  return <div className={styles.root} ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />
}
