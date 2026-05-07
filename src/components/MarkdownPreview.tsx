import MarkdownIt from 'markdown-it'
import markdownItAbbr from 'markdown-it-abbr'
import markdownItDeflist from 'markdown-it-deflist'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItKatex from 'markdown-it-katex'
import markdownItMark from 'markdown-it-mark'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import { makeStyles, tokens } from '@fluentui/react-components'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import 'katex/dist/katex.min.css'
import { extractFrontMatterTitle, stripFrontMatter } from '../shared/frontMatter'
import type { PreviewSyncPosition } from './MarkdownEditor'

const useStyles = makeStyles({
  root: {
    height: '560px',
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
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
  syncPosition?: PreviewSyncPosition
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

  md.core.ruler.push('source_line_attrs', (state) => {
    const lineForRenderedLine = state.env.lineForRenderedLine as ((line: number) => number) | undefined
    // Store source line numbers on block tokens so editor cursor movement can scroll the preview.
    for (const token of state.tokens) {
      if (!token.map || token.nesting === -1) continue
      const sourceLine = lineForRenderedLine?.(token.map[0] + 1) ?? token.map[0] + 1
      token.attrSet('data-source-line', String(sourceLine))
    }
  })

  return md
}

const bodyStartLine = (markdown: string) => {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return 1
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) return 1
  const afterFenceStart = end + 4
  return normalized.slice(0, normalized[afterFenceStart] === '\n' ? afterFenceStart + 1 : afterFenceStart).split('\n').length
}

export function MarkdownPreview({ markdown, resolveResourceUrl, syncPosition }: MarkdownPreviewProps) {
  const styles = useStyles()
  const rootRef = useRef<HTMLDivElement>(null)
  const syncPositionRef = useRef(syncPosition)
  const frameRef = useRef<number | undefined>(undefined)
  const renderer = useMemo(() => createMarkdownRenderer(resolveResourceUrl), [resolveResourceUrl])
  const html = useMemo(() => {
    const title = extractFrontMatterTitle(markdown)
    const body = stripFrontMatter(markdown)
    const titleLineCount = title ? 2 : 0
    const startLine = bodyStartLine(markdown)
    return renderer.render(`${title ? `# ${title}\n\n` : ''}${body}`, {
      lineForRenderedLine: (line: number) => (title && line <= titleLineCount ? 1 : line - titleLineCount + startLine - 1),
    })
  }, [markdown, renderer])

  const syncScroll = useCallback(() => {
    const position = syncPositionRef.current
    if (!position || !rootRef.current) return
    const element = rootRef.current
    const maxScrollTop = element.scrollHeight - element.clientHeight

    if (position.source === 'cursor') {
      const targets = Array.from(element.querySelectorAll<HTMLElement>('[data-source-line]'))
      const target = targets.reduce<HTMLElement | undefined>((matched, candidate) => {
        const sourceLine = Number(candidate.dataset.sourceLine)
        return Number.isFinite(sourceLine) && sourceLine <= position.line ? candidate : matched
      }, undefined)
      if (target) {
        element.scrollTop = Math.max(0, target.offsetTop - element.offsetTop - element.clientHeight * 0.18)
        return
      }
    }

    element.scrollTop = maxScrollTop > 0 ? maxScrollTop * position.ratio : 0
  }, [])

  const scheduleSyncScroll = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current ?? 0)
    frameRef.current = window.requestAnimationFrame(syncScroll)
  }, [syncScroll])

  useEffect(() => {
    syncPositionRef.current = syncPosition
    scheduleSyncScroll()
  }, [scheduleSyncScroll, syncPosition, html])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return undefined

    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleSyncScroll)
    for (const child of Array.from(element.children)) observer?.observe(child)

    const images = Array.from(element.querySelectorAll('img'))
    for (const image of images) {
      image.addEventListener('load', scheduleSyncScroll)
      image.addEventListener('error', scheduleSyncScroll)
      if (image.complete) scheduleSyncScroll()
    }

    return () => {
      observer?.disconnect()
      for (const image of images) {
        image.removeEventListener('load', scheduleSyncScroll)
        image.removeEventListener('error', scheduleSyncScroll)
      }
    }
  }, [html, scheduleSyncScroll])

  useEffect(() => {
    return () => window.cancelAnimationFrame(frameRef.current ?? 0)
  }, [])

  return <div className={styles.root} ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />
}
