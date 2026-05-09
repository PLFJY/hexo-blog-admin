# Theme Settings Adapter Development Guide

English | [简体中文](customize-adapter-development.md)

This guide is for developers who want to add theme settings support to `hexo-blog-admin`. The settings system is not meant to be a generic SaaS CMS. Its job is to expose the site content and theme options that a blog owner changes often enough to deserve a web UI.

## Design Goals

The settings system separates common Hexo behavior from theme-specific behavior through adapters:

- The `common` adapter is always enabled. It owns generic Hexo content such as `_config.yml` and the About page.
- Common Hexo behavior appears in the frontend as “Hexo Settings”; theme behavior appears as theme-named entries such as “Redefine Settings”.
- Theme adapters are enabled from `customize.detectedTheme` in `admin-index.json` v3. For example, `detectedTheme: redefine` enables the `redefine` adapter.
- Adding a new theme should only require a new adapter and registry entry. Worker routes, save flow, and deployment tracking should remain unchanged.
- Each theme adapter should live in its own `src/customize/<theme-name>/` directory. Redefine, for example, lives in `src/customize/redefine/`.
- `admin-index.json` v3 stores only `site` / `customize` summaries and the lightweight post index. It does not store configuration file contents.
- Article image indexes are not settings adapter data; they are managed by per-post asset shards.

The save flow is shared:

1. The Hexo Settings and theme settings pages read the `site` / `customize` summary from `/api/index` first, then display the current theme, adapters, panels, and file existence.
2. Structured panels read `/api/customize/panel?id=...`.
3. Raw file editing reads `/api/customize/file?id=...`.
4. On save, the Worker writes to the source blog repository through GitHub's Git Data API.
5. The frontend receives `commitSha` and polls GitHub Actions deployment status.
6. After a successful deploy, the frontend calls `/api/index/sync-online` to refetch the online admin-index and update the browser-local cache.

This means settings home pages should not scan the GitHub repository in real time just to display capabilities. Source files are read from GitHub only after the user opens a structured panel or Raw File Editor.

## Relevant Directories

```txt
src/customize/
  adapterTypes.ts       Adapter interfaces and read/write context types
  registry.ts           Adapter registration and manifest aggregation
  yaml.ts               YAML, front matter, and link map/list helpers
  common/adapter.ts     Generic Hexo adapter
  redefine/adapter.ts   Redefine adapter example

src/shared/customizeTypes.ts
  Shared frontend/Worker types for manifests, panels, files, save status, and structured data

src/worker/routes/customizeRoutes.ts
  Settings API route handlers

src/pages/Customize*.tsx
  Hexo Settings, theme settings, structured panel page, and raw file editor
```

## What An Adapter Declares

Each adapter implements `CustomizeAdapter`:

```ts
export type CustomizeAdapter = CustomizeAdapterSummary & {
  isEnabled: (context: CustomizeAdapterContext) => boolean
  files: CustomizeFileDescriptor[]
  panels: CustomizePanelDescriptor[]
  readPanel: (panelId: string, context: CustomizePanelReadContext) => unknown
  writePanel: (panelId: string, context: CustomizePanelWriteContext) => CustomizePanelWriteResult
}
```

Core fields:

- `id`: stable id, for example `butterfly`.
- `label`: display label, for example `Hexo Theme Butterfly`.
- `themeNames`: supported theme names, for example `['butterfly']`.
- `isEnabled`: decides whether the adapter is active. Usually checks `context.detectedTheme`.
- `files`: allowlist of files that may be read and saved.
- `panels`: structured editing panels provided by this adapter.
- `readPanel`: parses source files into frontend-editable data.
- `writePanel`: serializes frontend data back into one or more file contents.

## File Descriptors

File descriptors power both the manifest and Raw File Editor. They are also the Worker-side save allowlist.

```ts
const butterflyConfigFile = {
  id: 'butterfly-config',
  adapterId: 'butterfly',
  label: 'Butterfly _config.butterfly.yml',
  path: '_config.butterfly.yml',
  description: 'Butterfly theme configuration',
  language: 'yaml' as const,
}
```

Notes:

- `id` must be globally unique.
- `path` is a repository-relative path inside the blog source repository. Do not start it with `/`.
- Do not expose low-level developer configuration unless it should be editable from the admin UI.
- If a panel depends on `common` files, it can reference shared ids such as `site-config` and `about-page` in `fileIds`.

## Panel Descriptors

Panel descriptors decide how Hexo Settings or theme settings pages group and display features.

```ts
const panels = [
  {
    id: 'butterfly-visual',
    adapterId: 'butterfly',
    title: 'Butterfly Visual Basics',
    description: 'Edit favicon, avatar, primary color, and default color mode.',
    group: 'visual' as const,
    fileIds: ['butterfly-config'],
  },
]
```

Allowed `group` values:

```txt
basic
visual
navigation
pages
data
advanced
```

Suggested grouping:

- `basic`: site and theme identity.
- `visual`: colors, icons, avatars, banners.
- `navigation`: navbar, sidebar, menus.
- `pages`: About, page templates, standalone page front matter.
- `data`: structured `source/_data/*.yml` content.
- `advanced`: fallback items for advanced users.

## Read And Write Context

`readPanel` and `writePanel` receive this context:

```ts
type CustomizePanelReadContext = {
  detectedTheme?: string
  siteConfig: Record<string, unknown>
  themeConfig: Record<string, unknown>
  packageJson?: Record<string, unknown>
  files: Record<string, CustomizeFileState>
}
```

Where:

- `siteConfig` comes from `_config.yml`.
- `themeConfig` comes from `_config.<detectedTheme>.yml`, or an empty object when missing.
- `files` only contains the dependencies listed in the current panel's `fileIds`.
- `files[id].exists` lets the adapter offer creation for missing pages or data files.

## YAML And Markdown Helpers

Prefer the helpers in `src/customize/yaml.ts`:

- `parseYamlRecord(content)`: parse a YAML object.
- `parseYaml<T>(content, fallback)`: parse any YAML value.
- `stringifyYaml(value)`: stable YAML output.
- `setYamlPaths(content, updates)`: update selected YAML paths with less churn, useful for `_config.yml` and theme config files.
- `parseMarkdownPage(markdown, path)`: split front matter from body.
- `stringifyMarkdownPage(frontMatter, body)`: rebuild front matter and body.
- `getRecord`, `getArray`, `getString`, `getNumber`, `getBoolean`: safely read unknown data.
- `linkMapToList` / `linkListToMap`: turn theme link maps into sortable UI lists, then serialize them back.
- `mapToKeyValueItems` / `keyValueItemsToMap`: edit social links, QR code maps, and similar key/value objects.

When writing `_config.yml` or `_config.<theme>.yml`, prefer `setYamlPaths` to avoid unnecessary full-file rewrites. For structured `_data/*.yml` files, writing the whole file with `stringifyYaml` is usually fine.

## Adding A New Theme Adapter

Using Butterfly as an example:

1. Create a new directory:

```txt
src/customize/butterfly/
  adapter.ts
```

2. Implement the adapter:

```ts
import type { CustomizeAdapter } from '../adapterTypes'
import { getIn, getString, setYamlPaths } from '../yaml'

const butterflyConfigFile = {
  id: 'butterfly-config',
  adapterId: 'butterfly',
  label: 'Butterfly _config.butterfly.yml',
  path: '_config.butterfly.yml',
  language: 'yaml' as const,
}

export const butterflyAdapter: CustomizeAdapter = {
  id: 'butterfly',
  label: 'Hexo Theme Butterfly',
  themeNames: ['butterfly'],
  isEnabled: (context) => context.detectedTheme === 'butterfly',
  files: [butterflyConfigFile],
  panels: [
    {
      id: 'butterfly-visual',
      adapterId: 'butterfly',
      title: 'Butterfly Visual Basics',
      description: 'Edit common visual theme settings.',
      group: 'visual',
      fileIds: ['butterfly-config'],
    },
  ],
  readPanel(panelId, context) {
    if (panelId === 'butterfly-visual') {
      return {
        favicon: getString(getIn(context.themeConfig, ['favicon'])),
        avatar: getString(getIn(context.themeConfig, ['avatar', 'img'])),
      }
    }
    throw new Error(`Unknown Butterfly panel: ${panelId}`)
  },
  writePanel(panelId, context) {
    if (panelId === 'butterfly-visual') {
      const data = context.data as { favicon?: string; avatar?: string }
      return {
        files: [
          {
            id: 'butterfly-config',
            content: setYamlPaths(context.files['butterfly-config']?.content ?? '', [
              { path: ['favicon'], value: data.favicon ?? '' },
              { path: ['avatar', 'img'], value: data.avatar ?? '' },
            ]),
          },
        ],
      }
    }
    throw new Error(`Unknown Butterfly panel: ${panelId}`)
  },
}
```

3. Register the adapter:

```ts
// src/customize/registry.ts
import { butterflyAdapter } from './butterfly/adapter'

export const customizeAdapters: CustomizeAdapter[] = [
  commonAdapter,
  redefineAdapter,
  butterflyAdapter,
]
```

4. Add structured panel UI.

The current structured UI is dispatched by `panelId` in `PanelEditor` inside `src/pages/CustomizePanelPage.tsx`. Add an editor component for each structured panel:

```tsx
if (panelId === 'butterfly-visual') {
  return <ButterflyVisualEditor data={data as ButterflyVisualData} onChange={onChange} />
}
```

If you only need fallback editing, declare `files` without declaring panels. Raw File Editor will be able to edit the files, but the home page will not show a dedicated structured panel.

5. Update the blog-side admin-index summary generator.

`tools/generate-admin-index.mjs` emits the v3 lightweight index plus `site` and `customize` summaries. Once a theme adapter is official, add its adapter id, panel id, and editable file id/path/type/exists summaries there too if the panel should appear on Hexo Settings or theme settings pages. The admin-index should contain summaries only, not full config file contents; actual file contents are still read from GitHub source files by `/api/customize/panel` or `/api/customize/file`.

Article image indexes are managed by per-post asset shards under `public/admin-index/post-assets/<relativeId>.json`; do not model them as settings adapter capabilities.

## When To Build A Structured Panel

Good candidates:

- Site identity.
- Common visual theme settings.
- Menus, navbar links, sidebar links.
- Home banner and social links.
- Standalone page front matter and body.
- Regularly maintained `source/_data/*.yml` content.

Avoid structured panels for:

- Custom injected HTML / JS.
- CDN, build plugin, or developer-mode settings.
- Full complex comment provider configuration.
- Rare or risky options.

Leave those to Raw File Editor or direct repository edits.

## Data Modeling Tips

Themes often store links as maps:

```yaml
links:
  Home:
    path: /
    icon: fa-house
```

For sortable frontend editing, read them as arrays:

```ts
[
  { name: 'Home', path: '/', icon: 'fa-house' }
]
```

Write them back as maps on save. This keeps the UI ergonomic while preserving the theme's expected YAML shape.

If `source/_data/*.yml` is already an array, model it as an array and save it with `stringifyYaml`.

Markdown pages use this shared shape:

```ts
type MarkdownPageData = {
  exists: boolean
  path: string
  frontMatter: Record<string, unknown>
  body: string
}
```

When a page is missing, `readPanel` should return a sensible default so saving creates the file.

## Security Boundaries

- Raw File Editor can only read and write files declared by enabled adapters.
- The Worker resolves file ids back to descriptors on save. It does not accept arbitrary repo paths from the frontend.
- Panel saves can only write descriptor file ids returned by `writePanel`.
- Theme adapters should not bypass the GitHub commit service or build repository paths directly from unsanitized user input.

## Verification Checklist

After adding an adapter, verify:

- `customize.detectedTheme` in the generated `admin-index.json` enables the adapter.
- `/api/index` returns the new adapter, panel ids, and file summaries.
- Every panel GET returns structured data.
- Every panel PUT creates a GitHub commit.
- Raw File Editor can read and save declared files.
- The frontend can track deployment by `commitSha`.
- After successful deployment, the online admin-index can be refetched and the browser-local cache updates.
- `pnpm typecheck` passes.
- `pnpm build` passes.

If you changed the blog-side `tools/generate-admin-index.mjs`, run it in a real blog repository:

```bash
node tools/generate-admin-index.mjs
```

Confirm that `public/admin-index.json` includes the new `site` / `customize` summaries and that `public/admin-index/post-assets/` still contains the generated article image shards.
