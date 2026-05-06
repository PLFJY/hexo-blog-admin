#!/usr/bin/env node

// Copy this file to your Hexo blog repository, for example:
//
//   tools/generate-admin-index.mjs
//
// Then run it from the blog repository root after `hexo generate`:
//
//   node tools/generate-admin-index.mjs
//
// It scans Markdown files under `source/_posts/` and writes `public/admin-index.json`.

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const rootDir = process.cwd()
const postsDir = process.env.ADMIN_INDEX_POSTS_DIR ?? 'source/_posts'
const outputPath = process.env.ADMIN_INDEX_OUTPUT ?? 'public/admin-index.json'
const assetMode = 'post-folder'
const execFileAsync = promisify(execFile)

const imageExtensions = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
])

const toPosix = (value) => value.split(path.sep).join('/')
const trimMarkdownExtension = (value) => value.replace(/\.md$/i, '')

async function collectMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(fullPath))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

async function collectAssets(assetDirAbsolute, assetDirRepo, postSlug) {
  try {
    const entries = await fs.readdir(assetDirAbsolute, { withFileTypes: true })
    const assets = await Promise.all(entries
      .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
      .map(async (entry) => ({
        filename: entry.name,
        repoPath: `${assetDirRepo}/${entry.name}`,
        markdownPath: `${postSlug}/${entry.name}`,
        size: (await fs.stat(path.join(assetDirAbsolute, entry.name))).size,
      })))

    return assets.sort((a, b) => a.filename.localeCompare(b.filename))
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

function parseFrontMatter(markdown) {
  if (!markdown.startsWith('---')) return {}

  const end = markdown.indexOf('\n---', 3)
  if (end === -1) return {}

  return parseSimpleYaml(markdown.slice(3, end).trim())
}

function parseSimpleYaml(raw) {
  const result = {}
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    index += 1

    if (!line.trim() || line.trimStart().startsWith('#')) continue

    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!match) continue

    const [, key, value] = match
    if (value === '') {
      const list = []
      while (index < lines.length) {
        const next = lines[index]
        const itemMatch = /^\s*-\s*(.*)$/.exec(next)
        if (!itemMatch) break
        list.push(parseScalar(itemMatch[1]))
        index += 1
      }
      result[key] = list
    } else {
      result[key] = parseScalar(value)
    }
  }

  return result
}

function parseScalar(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter(Boolean)
  }

  return unquote(trimmed)
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  return value
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed && Number.isFinite(Date.parse(trimmed)) ? trimmed : undefined
  }
  return undefined
}

async function getSourceCommitSha() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: rootDir })
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

async function getGitFileDate(repoPath) {
  try {
    const { stdout } = await execFileAsync('git', ['log', '--follow', '--format=%aI', '-n', '1', '--', repoPath], { cwd: rootDir })
    return normalizeDate(stdout.trim())
  } catch {
    return undefined
  }
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return [value]
  return []
}

function normalizePublished(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return true
}

function addToTree(tree, post) {
  const segments = post.relativeId.split('/')
  let current = tree
  let idPrefix = ''

  for (const segment of segments.slice(0, -1)) {
    idPrefix = idPrefix ? `${idPrefix}/${segment}` : segment
    let folder = current.find((node) => node.type === 'folder' && node.id === idPrefix)

    if (!folder) {
      folder = {
        id: idPrefix,
        name: segment,
        type: 'folder',
        sortPublishedAt: post.publishedAt,
        children: [],
      }
      current.push(folder)
    }

    folder.sortPublishedAt = olderDate(folder.sortPublishedAt, post.publishedAt)
    current = folder.children
  }

  current.push({
    id: post.relativeId,
    name: segments.at(-1) ?? post.relativeId,
    type: 'post',
    sortPublishedAt: post.publishedAt,
    post,
  })
}

function timestamp(value) {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? time : 0
}

function olderDate(a, b) {
  if (!a) return b
  if (!b) return a
  return timestamp(a) <= timestamp(b) ? a : b
}

function sortTree(nodes) {
  nodes.sort((a, b) => {
    const dateDiff = timestamp(b.sortPublishedAt) - timestamp(a.sortPublishedAt)
    if (dateDiff !== 0) return dateDiff
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  for (const node of nodes) {
    if (node.children) sortTree(node.children)
  }
}

async function main() {
  const postsRoot = path.join(rootDir, postsDir)
  const markdownFiles = await collectMarkdownFiles(postsRoot)
  const posts = []

  for (const absolutePath of markdownFiles) {
    const repoPath = toPosix(path.relative(rootDir, absolutePath))
    const relativeMarkdownPath = toPosix(path.relative(postsRoot, absolutePath))
    const relativeId = trimMarkdownExtension(relativeMarkdownPath)
    const postSlug = path.basename(relativeId)
    const folderPath = toPosix(path.dirname(relativeId)).replace(/^\.$/, '')
    const assetDirRepo = [postsDir, folderPath, postSlug].filter(Boolean).join('/')
    const markdown = await fs.readFile(absolutePath, 'utf8')
    const frontMatter = parseFrontMatter(markdown)
    const publishedAt = normalizeDate(frontMatter.date) ?? await getGitFileDate(repoPath)
    const published = normalizePublished(frontMatter.published)

    posts.push({
      relativeId,
      title: typeof frontMatter.title === 'string' ? frontMatter.title : postSlug,
      path: repoPath,
      metadata: {
        publishedAt,
        published,
      },
      publishedAt,
      published,
      folderPath,
      postSlug,
      assetDir: `${assetDirRepo}/`,
      markdownAssetPrefix: postSlug,
      date: publishedAt,
      updated: normalizeDate(frontMatter.updated),
      tags: normalizeStringArray(frontMatter.tags),
      categories: normalizeStringArray(frontMatter.categories),
      assets: await collectAssets(path.join(rootDir, assetDirRepo), assetDirRepo, postSlug),
    })
  }

  posts.sort((a, b) => {
    const dateDiff = timestamp(b.publishedAt) - timestamp(a.publishedAt)
    return dateDiff || a.relativeId.localeCompare(b.relativeId)
  })

  const tree = []
  for (const post of posts) {
    addToTree(tree, post)
  }
  sortTree(tree)

  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceCommitSha: await getSourceCommitSha(),
    postsDir,
    assetMode,
    posts,
    tree,
  }

  const outputAbsolutePath = path.join(rootDir, outputPath)
  await fs.mkdir(path.dirname(outputAbsolutePath), { recursive: true })
  await fs.writeFile(outputAbsolutePath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')

  console.log(`Generated ${outputPath} with ${posts.length} posts.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
