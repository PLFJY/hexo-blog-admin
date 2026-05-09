import type {
  CustomizeFileDescriptor,
  CustomizeFileResponse,
  CustomizeFileSaveRequest,
  CustomizeManifestResponse,
  CustomizePanelResponse,
  CustomizePanelSaveRequest,
  CustomizeSaveResponse,
} from '../../shared/customizeTypes'
import type { CustomizeAdapterContext, CustomizeFileState } from '../../customize/adapterTypes'
import type { WorkerEnv } from '../env'
import {
  buildCustomizeManifest,
  customizeAdapters,
  getEnabledCustomizeAdapters,
  getManifestDescriptors,
} from '../../customize/registry'
import { getString, parseYamlRecord } from '../../customize/yaml'
import { getGitHubFile } from '../services/github/githubContent'
import { createBatchCommit } from '../services/github/githubGitCommit'
import { getAdminIndex } from '../services/indexer/adminIndex'
import { requireConfig } from '../utils/config'
import { json } from '../utils/response'

type OptionalGitHubFile = {
  content: string
  sha?: string
  exists: boolean
}

function isGitHubNotFound(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes('not found')
}

async function getGitHubFileOptional(env: WorkerEnv, path: string): Promise<OptionalGitHubFile> {
  try {
    const file = await getGitHubFile(env, path)
    return { ...file, exists: true }
  } catch (error) {
    if (isGitHubNotFound(error)) return { content: '', exists: false }
    throw error
  }
}

async function getPackageJson(env: WorkerEnv) {
  const file = await getGitHubFileOptional(env, 'package.json')
  if (!file.exists || !file.content.trim()) return undefined
  try {
    const parsed = JSON.parse(file.content) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

async function buildCustomizeContext(env: WorkerEnv): Promise<CustomizeAdapterContext> {
  const siteFile = await getGitHubFile(env, '_config.yml')
  const siteConfig = parseYamlRecord(siteFile.content)
  const detectedTheme = getString(siteConfig.theme).trim().toLowerCase() || undefined
  const themeFile = detectedTheme ? await getGitHubFileOptional(env, `_config.${detectedTheme}.yml`) : undefined
  return {
    detectedTheme,
    siteConfig,
    themeConfig: themeFile?.exists ? parseYamlRecord(themeFile.content) : {},
    packageJson: await getPackageJson(env),
  }
}

async function readDescriptorFiles(
  env: WorkerEnv,
  descriptors: CustomizeFileDescriptor[],
): Promise<Record<string, CustomizeFileState>> {
  const entries = await Promise.all(descriptors.map(async (descriptor) => {
    const file = await getGitHubFileOptional(env, descriptor.path)
    return [
      descriptor.id,
      {
        descriptor,
        content: file.content,
        sha: file.sha,
        exists: file.exists,
      },
    ] as const
  }))
  return Object.fromEntries(entries) as Record<string, CustomizeFileState>
}

async function getManifest(env: WorkerEnv): Promise<CustomizeManifestResponse> {
  const index = await getAdminIndex(env)
  const detectedTheme = index.customize?.detectedTheme ?? index.site?.theme?.name
  const availableAdapters = index.customize?.availableAdapters?.length ? index.customize.availableAdapters : ['common']
  const context: CustomizeAdapterContext = {
    detectedTheme,
    siteConfig: {
      title: index.site?.title,
      subtitle: index.site?.subtitle,
      author: index.site?.author,
      url: index.site?.url,
      language: index.site?.language,
      timezone: index.site?.timezone,
      theme: detectedTheme,
    },
    themeConfig: {},
    packageJson: undefined,
  }
  const enabledAdapters = customizeAdapters.filter((adapter) => availableAdapters.includes(adapter.id))
  const descriptors = getManifestDescriptors(enabledAdapters)
  const files = descriptors.files.map((file) => {
    const summary = index.customize?.files?.find((item) => item.id === file.id)
    return { ...file, exists: Boolean(summary?.exists) }
  })
  return buildCustomizeManifest(context, files, descriptors.panels, enabledAdapters)
}

async function getRuntime(env: WorkerEnv) {
  const context = await buildCustomizeContext(env)
  const enabledAdapters = getEnabledCustomizeAdapters(context)
  const descriptors = getManifestDescriptors(enabledAdapters)
  return {
    context,
    enabledAdapters,
    descriptors,
  }
}

export async function handleCustomizeManifest(env: WorkerEnv): Promise<Response> {
  return json(await getManifest(env))
}

export async function handleCustomizeFile(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'BAD_REQUEST', message: 'id is required' }, { status: 400 })
  const runtime = await getRuntime(env)
  const descriptor = runtime.descriptors.files.find((file) => file.id === id)
  if (!descriptor) return json({ error: 'NOT_FOUND', message: 'Editable file not found' }, { status: 404 })
  const file = await getGitHubFileOptional(env, descriptor.path)
  const response: CustomizeFileResponse = {
    file: { ...descriptor, exists: file.exists },
    content: file.content,
    sha: file.sha,
    exists: file.exists,
  }
  return json(response)
}

export async function handleSaveCustomizeFile(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'PUT') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const body = await request.json() as CustomizeFileSaveRequest
  if (!body.id || typeof body.content !== 'string') {
    return json({ error: 'BAD_REQUEST', message: 'id and content are required' }, { status: 400 })
  }
  const runtime = await getRuntime(env)
  const descriptor = runtime.descriptors.files.find((file) => file.id === body.id)
  if (!descriptor) return json({ error: 'NOT_FOUND', message: 'Editable file not found' }, { status: 404 })
  const config = requireConfig(env)
  const commit = await createBatchCommit(env, {
    branch: config.GITHUB_BRANCH,
    message: `Customize ${descriptor.path}`,
    files: [{ path: descriptor.path, encoding: 'utf-8', content: body.content }],
  })
  const response: CustomizeSaveResponse = { commitSha: commit.commitSha }
  return json(response)
}

export async function handleCustomizePanel(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'BAD_REQUEST', message: 'id is required' }, { status: 400 })
  const runtime = await getRuntime(env)
  const panel = runtime.descriptors.panels.find((item) => item.id === id)
  if (!panel) return json({ error: 'NOT_FOUND', message: 'Customize panel not found' }, { status: 404 })
  const adapter = runtime.enabledAdapters.find((item) => item.id === panel.adapterId)
  if (!adapter) return json({ error: 'NOT_FOUND', message: 'Customize adapter not enabled' }, { status: 404 })
  const dependentDescriptors = runtime.descriptors.files.filter((file) => panel.fileIds.includes(file.id))
  const files = await readDescriptorFiles(env, dependentDescriptors)
  const data = adapter.readPanel(panel.id, { ...runtime.context, files })
  const response: CustomizePanelResponse = { panel, data }
  return json(response)
}

export async function handleSaveCustomizePanel(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'PUT') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const body = await request.json() as CustomizePanelSaveRequest
  if (!body.id) return json({ error: 'BAD_REQUEST', message: 'id is required' }, { status: 400 })
  const runtime = await getRuntime(env)
  const panel = runtime.descriptors.panels.find((item) => item.id === body.id)
  if (!panel) return json({ error: 'NOT_FOUND', message: 'Customize panel not found' }, { status: 404 })
  const adapter = runtime.enabledAdapters.find((item) => item.id === panel.adapterId)
  if (!adapter) return json({ error: 'NOT_FOUND', message: 'Customize adapter not enabled' }, { status: 404 })
  const dependentDescriptors = runtime.descriptors.files.filter((file) => panel.fileIds.includes(file.id))
  const files = await readDescriptorFiles(env, dependentDescriptors)
  const result = adapter.writePanel(panel.id, { ...runtime.context, files, data: body.data })
  const fileMap = new Map(runtime.descriptors.files.map((file) => [file.id, file]))
  const commitFiles = result.files.map((file) => {
    const descriptor = fileMap.get(file.id)
    if (!descriptor) throw new Error(`Editable file descriptor missing for ${file.id}`)
    return {
      path: descriptor.path,
      encoding: 'utf-8' as const,
      content: file.content,
    }
  })
  if (commitFiles.length === 0) return json({ error: 'BAD_REQUEST', message: 'No files to save' }, { status: 400 })
  const config = requireConfig(env)
  const commit = await createBatchCommit(env, {
    branch: config.GITHUB_BRANCH,
    message: `Customize ${panel.title}`,
    files: commitFiles,
  })
  const response: CustomizeSaveResponse = { commitSha: commit.commitSha }
  return json(response)
}
