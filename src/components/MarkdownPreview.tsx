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
import { useAppTheme } from '../app/ThemeProvider'
import { extractFrontMatterTitle, stripFrontMatter } from '../shared/frontMatter'
import type { ResolvedMarkdownResourceUrl } from '../lib/markdownResource'

const useStyles = makeStyles({
  root: {
    position: 'relative',
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
    '& > :nth-last-child(2)': {
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
    '& .hba-public-url-image': {
      position: 'relative',
      display: 'inline-block',
      maxWidth: '100%',
      lineHeight: 0,
    },
    '& .hba-public-url-image img': {
      display: 'block',
      outline: `2px solid ${tokens.colorBrandBackground}`,
      outlineOffset: '2px',
    },
    '& .hba-public-url-image__badge': {
      position: 'absolute',
      top: tokens.spacingVerticalXS,
      right: tokens.spacingHorizontalXS,
      padding: '2px 6px',
      borderRadius: tokens.borderRadiusSmall,
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorBrandBackground,
      fontSize: '11px',
      lineHeight: '14px',
      fontWeight: tokens.fontWeightSemibold,
      pointerEvents: 'none',
      boxShadow: tokens.shadow4,
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
    '& .hba-mermaid': {
      overflowX: 'auto',
      margin: `${tokens.spacingVerticalM} 0`,
      padding: tokens.spacingVerticalM,
      borderRadius: tokens.borderRadiusMedium,
      backgroundColor: tokens.colorNeutralBackground3,
      textAlign: 'center',
    },
    '& .hba-mermaid svg': {
      maxWidth: '100%',
      height: 'auto',
    },
    '& .hba-mermaid__source': {
      margin: 0,
      textAlign: 'left',
      whiteSpace: 'pre-wrap',
    },
    '& .hba-mermaid[data-mermaid-status="pending"] .hba-mermaid__source': {
      display: 'none',
    },
    '& .hba-mermaid__placeholder': {
      color: tokens.colorNeutralForeground3,
      fontSize: '12px',
      lineHeight: tokens.lineHeightBase300,
    },
    '& .hba-mermaid[data-mermaid-status="error"]': {
      border: `1px solid ${tokens.colorPaletteRedBorder2}`,
      backgroundColor: tokens.colorPaletteRedBackground1,
      textAlign: 'left',
    },
    '& .hba-mermaid__error-card': {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0, 1fr)',
      gap: tokens.spacingHorizontalM,
      alignItems: 'start',
      padding: tokens.spacingVerticalM,
      borderRadius: tokens.borderRadiusMedium,
    },
    '& .hba-mermaid__error-icon': {
      fontSize: '36px',
      lineHeight: '40px',
    },
    '& .hba-mermaid__error-content': {
      minWidth: 0,
    },
    '& .hba-mermaid__error-title': {
      color: tokens.colorPaletteRedForeground1,
      fontWeight: tokens.fontWeightSemibold,
      fontSize: '15px',
      lineHeight: '22px',
    },
    '& .hba-mermaid__error-meta': {
      marginTop: tokens.spacingVerticalXXS,
      color: tokens.colorNeutralForeground2,
      fontSize: '12px',
      lineHeight: tokens.lineHeightBase300,
    },
    '& .hba-mermaid__error-message': {
      margin: `${tokens.spacingVerticalS} 0 0`,
      padding: tokens.spacingVerticalS,
      borderRadius: tokens.borderRadiusSmall,
      backgroundColor: tokens.colorNeutralBackground1,
      color: tokens.colorPaletteRedForeground1,
      whiteSpace: 'pre-wrap',
      overflowX: 'auto',
    },
    '& .hba-mermaid[data-mermaid-status="error"] .hba-mermaid__source': {
      marginTop: tokens.spacingVerticalS,
      maxHeight: '220px',
      overflow: 'auto',
    },
    '& .hba-source-line-sentinel': {
      display: 'block',
      height: 0,
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
    },
  },
})

type MarkdownPreviewProps = {
  markdown: string
  resolveResourceUrl?: (src: string) => ResolvedMarkdownResourceUrl
  onPreviewRootReady?: (element: HTMLDivElement | null) => void
  onPreviewContentChange?: () => void
  onMermaidRenderErrorsChange?: (errors: MermaidRenderError[]) => void
}

export type MermaidRenderError = {
  index: number
  line?: number
  message: string
}

type MermaidRenderCacheEntry = {
  svg: string
  height?: number
}

const areMermaidRenderErrorsEqual = (left: MermaidRenderError[], right: MermaidRenderError[]) =>
  left.length === right.length &&
  left.every((error, index) => {
    const other = right[index]
    return error.index === other.index && error.line === other.line && error.message === other.message
  })

const normalizeResolvedResourceUrl = (resolved: ResolvedMarkdownResourceUrl | undefined, fallback: string) => {
  if (!resolved) return { url: fallback, publicAsset: false }
  return typeof resolved === 'string'
    ? { url: resolved, publicAsset: false, fallbackUrl: undefined }
    : { url: resolved.url, publicAsset: Boolean(resolved.publicAsset), fallbackUrl: resolved.fallbackUrl }
}

const escapeHtml = (value: string) => MarkdownIt().utils.escapeHtml(value)
const renderTokenAttrs = (attrs: [string, string][]) =>
  attrs.map(([name, value]) => ` ${escapeHtml(name)}="${escapeHtml(value)}"`).join('')

const hashString = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

const getMermaidCacheKey = (source: string, theme: string) => `${theme}:${hashString(source)}`

const escapeCssIdentifier = (value: string) => {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

const cleanupMermaidArtifacts = (root: HTMLElement | null, id: string) => {
  const escapedId = escapeCssIdentifier(id)
  document.querySelectorAll<Element>(`#${escapedId}, [id^="${escapedId}-"]`).forEach((node) => {
    if (!root?.contains(node)) node.remove()
  })
}

const renderMermaidErrorBlock = (
  block: HTMLElement,
  {
    source,
    line,
    title,
    message,
  }: {
    source: string
    line?: number
    title: string
    message: string
  },
) => {
  const meta = line ? `第 ${line} 行附近` : '请检查该 Mermaid 代码块'
  block.dataset.mermaidSource = source
  block.dataset.mermaidStatus = 'error'
  block.innerHTML = `
    <div class="hba-mermaid__error-card">
      <div class="hba-mermaid__error-icon" aria-hidden="true">💣</div>
      <div class="hba-mermaid__error-content">
        <div class="hba-mermaid__error-title">${escapeHtml(title)}</div>
        <div class="hba-mermaid__error-meta">${escapeHtml(meta)}</div>
        <pre class="hba-mermaid__error-message">${escapeHtml(message)}</pre>
      </div>
    </div>
    <pre class="hba-mermaid__source">${escapeHtml(source)}</pre>
  `
}

const createMermaidScratchContainer = (block: HTMLElement) => {
  const scratch = document.createElement('div')
  scratch.className = 'hba-mermaid__scratch'
  scratch.setAttribute('aria-hidden', 'true')

  scratch.style.position = 'absolute'
  scratch.style.left = '-100000px'
  scratch.style.top = '0'
  scratch.style.width = `${Math.max(block.clientWidth, 320)}px`
  scratch.style.pointerEvents = 'none'
  scratch.style.visibility = 'hidden'
  scratch.style.overflow = 'hidden'

  block.appendChild(scratch)
  return scratch
}

function createMarkdownRenderer(
  resolveResourceUrl: ((src: string) => ResolvedMarkdownResourceUrl) | undefined,
  getCachedMermaidSvg?: (source: string) => string | undefined,
) {
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
    let publicAsset = false
    if (src) {
      const resolved = normalizeResolvedResourceUrl(resolveResourceUrl?.(src), src)
      token.attrSet('src', resolved.url)
      if (resolved.fallbackUrl && resolved.fallbackUrl !== resolved.url) token.attrSet('data-public-url-fallback', resolved.fallbackUrl)
      publicAsset = resolved.publicAsset
    }
    const imageHtml = defaultImageRenderer ? defaultImageRenderer(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
    return publicAsset
      ? `<span class="hba-public-url-image">${imageHtml}<span class="hba-public-url-image__badge">PUBLIC</span></span>`
      : imageHtml
  }

  const defaultFenceRenderer = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const language = token.info.trim().split(/\s+/)[0]?.toLowerCase()
    if (language !== 'mermaid') {
      return defaultFenceRenderer ? defaultFenceRenderer(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
    }

    const cachedSvg = getCachedMermaidSvg?.(token.content)
    if (cachedSvg) {
      token.attrJoin('class', 'hba-mermaid')
      token.attrSet('data-mermaid-status', 'rendered')
      const attrs = renderTokenAttrs(token.attrs ?? [])
      return `<div${attrs}>${cachedSvg}</div>`
    }

    token.attrJoin('class', 'hba-mermaid')
    token.attrSet('data-mermaid-status', 'pending')
    const attrs = renderTokenAttrs(token.attrs ?? [])
    return `<div${attrs}><pre class="hba-mermaid__source" hidden>${escapeHtml(token.content)}</pre><div class="hba-mermaid__placeholder">Rendering Mermaid diagram...</div></div>`
  }

  const defaultLinkOpenRenderer = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const href = token.attrGet('href')
    if (href) token.attrSet('href', normalizeResolvedResourceUrl(resolveResourceUrl?.(href), href).url)
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noreferrer')
    return defaultLinkOpenRenderer ? defaultLinkOpenRenderer(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
  }

  md.core.ruler.push('source_line_attrs', (state) => {
    const lineForRenderedLine = state.env.lineForRenderedLine as ((line: number) => number) | undefined
    // Store source line numbers on block tokens so editor cursor movement can scroll the preview.
    for (const token of state.tokens) {
      if (!token.map || token.nesting === -1) continue
      const startLine = lineForRenderedLine?.(token.map[0] + 1) ?? token.map[0] + 1
      const endLine = lineForRenderedLine?.(token.map[1]) ?? token.map[1]
      token.attrSet('data-source-line', String(startLine))
      token.attrSet('data-source-end-line', String(Math.max(startLine, endLine)))
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

const sourceLineCount = (markdown: string) => Math.max(1, markdown.replace(/\r\n/g, '\n').split('\n').length)

export function MarkdownPreview({
  markdown,
  resolveResourceUrl,
  onPreviewRootReady,
  onPreviewContentChange,
  onMermaidRenderErrorsChange,
}: MarkdownPreviewProps) {
  const styles = useStyles()
  const { resolvedMode } = useAppTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const onPreviewRootReadyRef = useRef(onPreviewRootReady)
  const onPreviewContentChangeRef = useRef(onPreviewContentChange)
  const onMermaidRenderErrorsChangeRef = useRef(onMermaidRenderErrorsChange)
  const lastMermaidRenderErrorsRef = useRef<MermaidRenderError[]>([])
  const mermaidRenderRunRef = useRef(0)
  const mermaidRenderCache = useMemo(() => new Map<string, MermaidRenderCacheEntry>(), [])
  const mermaidTheme = resolvedMode === 'dark' ? 'dark' : 'default'
  const renderer = useMemo(
    () =>
      createMarkdownRenderer(resolveResourceUrl, (source) => {
        const cacheKey = getMermaidCacheKey(source, mermaidTheme)
        return mermaidRenderCache.get(cacheKey)?.svg
      }),
    [mermaidRenderCache, resolveResourceUrl, mermaidTheme],
  )
  const html = useMemo(() => {
    const title = extractFrontMatterTitle(markdown)
    const body = stripFrontMatter(markdown)
    const titleLineCount = title ? 2 : 0
    const startLine = bodyStartLine(markdown)
    const rendered = renderer.render(`${title ? `# ${title}\n\n` : ''}${body}`, {
      lineForRenderedLine: (line: number) => (title && line <= titleLineCount ? 1 : line - titleLineCount + startLine - 1),
    })
    const lineCount = sourceLineCount(markdown)
    return `${rendered}<div data-source-line="${lineCount}" data-source-end-line="${lineCount}" class="hba-source-line-sentinel"></div>`
  }, [markdown, renderer])

  useEffect(() => {
    onPreviewRootReadyRef.current = onPreviewRootReady
  }, [onPreviewRootReady])

  useEffect(() => {
    onPreviewContentChangeRef.current = onPreviewContentChange
  }, [onPreviewContentChange])

  useEffect(() => {
    onMermaidRenderErrorsChangeRef.current = onMermaidRenderErrorsChange
  }, [onMermaidRenderErrorsChange])

  const emitMermaidRenderErrors = (errors: MermaidRenderError[]) => {
    if (areMermaidRenderErrorsEqual(lastMermaidRenderErrorsRef.current, errors)) return
    lastMermaidRenderErrorsRef.current = errors
    onMermaidRenderErrorsChangeRef.current?.(errors)
  }

  useEffect(() => {
    onPreviewRootReadyRef.current?.(rootRef.current)
    return () => onPreviewRootReadyRef.current?.(null)
  }, [])

  useEffect(() => {
    const element = rootRef.current
    const hasPendingMermaid = Boolean(element?.querySelector('.hba-mermaid[data-mermaid-status="pending"]'))
    if (!hasPendingMermaid) {
      emitMermaidRenderErrors([])
      onPreviewContentChangeRef.current?.()
    }
  }, [html])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return undefined

    const initialBlocks = Array.from(
      element.querySelectorAll<HTMLElement>('.hba-mermaid[data-mermaid-status="pending"]'),
    )
    if (initialBlocks.length === 0) return undefined

    const renderRun = mermaidRenderRunRef.current + 1
    mermaidRenderRunRef.current = renderRun
    let cancelled = false
    let settleFrame: number | undefined
    const notifyPreviewContentChange = () => {
      settleFrame = window.requestAnimationFrame(() => {
        settleFrame = window.requestAnimationFrame(() => {
          if (!cancelled && mermaidRenderRunRef.current === renderRun) onPreviewContentChangeRef.current?.()
        })
      })
    }
    const renderMermaidBlocks = async () => {
      const mermaid = (await import('mermaid')).default
      if (cancelled || mermaidRenderRunRef.current !== renderRun) return

      const mermaidConfig = {
        startOnLoad: false,
        securityLevel: 'strict',
        theme: mermaidTheme,
        suppressErrorRendering: true,
      } satisfies Parameters<typeof mermaid.initialize>[0] & { suppressErrorRendering: boolean }

      mermaid.initialize(mermaidConfig)

      const currentElement = rootRef.current
      if (!currentElement) return
      const blocks = Array.from(
        currentElement.querySelectorAll<HTMLElement>('.hba-mermaid[data-mermaid-status="pending"]'),
      )
      const errors: MermaidRenderError[] = []
      for (const [index, block] of blocks.entries()) {
        if (cancelled || mermaidRenderRunRef.current !== renderRun || !block.isConnected) return
        const source = block.dataset.mermaidSource ?? block.querySelector<HTMLElement>('.hba-mermaid__source')?.textContent ?? ''
        if (!source.trim()) {
          block.dataset.mermaidSource = source
          block.innerHTML = ''
          block.dataset.mermaidStatus = 'rendered'
          continue
        }

        const line = Number.isFinite(Number(block.dataset.sourceLine)) ? Number(block.dataset.sourceLine) : undefined

        const cacheKey = getMermaidCacheKey(source, mermaidTheme)
        const cached = mermaidRenderCache.get(cacheKey)
        if (cached) {
          block.dataset.mermaidSource = source
          block.innerHTML = cached.svg
          block.dataset.mermaidStatus = 'rendered'
          continue
        }

        let parsed: boolean

        try {
          parsed = Boolean(await mermaid.parse(source, { suppressErrors: true }))
        } catch (error) {
          if (cancelled || mermaidRenderRunRef.current !== renderRun || !block.isConnected) return
          const message = error instanceof Error ? error.message : 'Mermaid 语法错误'
          renderMermaidErrorBlock(block, {
            source,
            line,
            title: 'Mermaid 语法错误',
            message,
          })
          errors.push({
            index,
            line,
            message,
          })
          continue
        }

        if (!parsed) {
          const message = 'Mermaid 语法错误'
          renderMermaidErrorBlock(block, {
            source,
            line,
            title: 'Mermaid 语法错误',
            message,
          })
          errors.push({ index, line, message })
          continue
        }

        const id = `hba-mermaid-${renderRun}-${index}`
        const renderContainer = createMermaidScratchContainer(block)

        try {
          const { svg, bindFunctions } = await mermaid.render(id, source, renderContainer)
          if (cancelled || mermaidRenderRunRef.current !== renderRun || !block.isConnected) return
          block.dataset.mermaidSource = source
          block.innerHTML = svg
          mermaidRenderCache.set(cacheKey, {
            svg,
            height: block.offsetHeight,
          })
          if (mermaidRenderCache.size > 50) {
            const oldestKey = mermaidRenderCache.keys().next().value
            if (oldestKey) mermaidRenderCache.delete(oldestKey)
          }
          block.dataset.mermaidStatus = 'rendered'
          bindFunctions?.(block)
        } catch (error) {
          if (cancelled || mermaidRenderRunRef.current !== renderRun || !block.isConnected) return
          const message = error instanceof Error ? error.message : 'Mermaid 渲染失败'
          renderMermaidErrorBlock(block, {
            source,
            line,
            title: 'Mermaid 渲染失败',
            message,
          })
          errors.push({
            index,
            line,
            message,
          })
        } finally {
          renderContainer.remove()
          cleanupMermaidArtifacts(rootRef.current, id)
        }
      }

      if (!cancelled && mermaidRenderRunRef.current === renderRun) {
        errors.sort((a, b) => a.index - b.index)
        emitMermaidRenderErrors(errors)
      }
      if (!cancelled) notifyPreviewContentChange()
    }

    const frame = window.requestAnimationFrame(() => {
      void renderMermaidBlocks()
    })
    return () => {
      cancelled = true
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      if (settleFrame !== undefined) window.cancelAnimationFrame(settleFrame)
    }
  }, [html, mermaidRenderCache, mermaidTheme])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return undefined

    const invalidateAfterImageChange = () => onPreviewContentChangeRef.current?.()

    const fallbackPublicImage = (event: Event) => {
      const image = event.target
      if (!(image instanceof HTMLImageElement)) return
      const fallbackUrl = image.dataset.publicUrlFallback
      if (!fallbackUrl || image.src === new URL(fallbackUrl, window.location.href).href) return

      delete image.dataset.publicUrlFallback
      image.src = fallbackUrl
      const wrapper = image.closest('.hba-public-url-image')
      wrapper?.classList.remove('hba-public-url-image')
      wrapper?.querySelector('.hba-public-url-image__badge')?.remove()
      onPreviewContentChangeRef.current?.()
    }

    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(invalidateAfterImageChange)
    observer?.observe(element)
    element.addEventListener('error', fallbackPublicImage, true)

    const images = Array.from(element.querySelectorAll('img'))
    for (const image of images) {
      image.addEventListener('load', invalidateAfterImageChange)
      image.addEventListener('error', invalidateAfterImageChange)
      if (image.complete) onPreviewContentChangeRef.current?.()
    }

    return () => {
      observer?.disconnect()
      element.removeEventListener('error', fallbackPublicImage, true)
      for (const image of images) {
        image.removeEventListener('load', invalidateAfterImageChange)
        image.removeEventListener('error', invalidateAfterImageChange)
      }
    }
  }, [html])

  return <div className={styles.root} ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />
}
