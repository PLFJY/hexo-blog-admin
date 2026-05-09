# 主题设置 Adapter 开发指南

简体中文 | [English](customize-adapter-development.en.md)

本文档面向想为 `hexo-blog-admin` 新增主题设置支持的开发者。设置体系的目标不是做通用 SaaS CMS，而是把博客维护者日常会改、适合网页后台编辑的配置和页面内容做成可维护的面板。

## 设计目标

设置体系使用 adapter 机制拆分通用 Hexo 能力和主题专属能力：

- `common` adapter 永远启用，负责 Hexo 通用内容，例如 `_config.yml` 和 About 页面。
- 通用 Hexo 能力在前端显示为“Hexo 设置”，主题能力显示为“Redefine 设置”这类按主题命名的入口。
- 主题 adapter 按 `admin-index.json` v3 的 `customize.detectedTheme` 启用，例如 `detectedTheme: redefine` 会启用 `redefine` adapter。
- 新主题只需要新增自己的 adapter 并注册，不需要改 Worker 路由、保存流程或部署追踪流程。
- 每个主题 adapter 的代码应放在 `src/customize/<theme-name>/` 独立目录中，例如 Redefine 位于 `src/customize/redefine/`。
- `admin-index.json` v3 只保存 `site` / `customize` 摘要和文章轻索引，不保存配置文件正文。
- 文章图片索引不属于设置 adapter；它由 per-post asset shard 管理。

保存链路统一由 Worker 负责：

1. “Hexo 设置”和主题设置页优先读取 `/api/index` 中的 `site` / `customize` 摘要，展示当前主题、可用 adapter、面板和文件存在状态。
2. 结构化面板读取 `/api/customize/panel?id=...`。
3. Raw 文件读取 `/api/customize/file?id=...`。
4. 保存时 Worker 通过 GitHub Git Data API 写入博客源站仓库。
5. 前端拿到 `commitSha` 后轮询 GitHub Actions 部署状态。
6. 部署成功后调用 `/api/index/sync-online` 重新读取线上 admin-index，并更新浏览器本地缓存。

这意味着设置首页不应该为了展示能力摘要实时扫描 GitHub 仓库。GitHub 源文件读取只发生在进入具体面板或 Raw File Editor 时。

## 相关目录

```txt
src/customize/
  adapterTypes.ts       Adapter 接口和读写上下文类型
  registry.ts           Adapter 注册与 manifest 汇总
  yaml.ts               YAML、front matter、链接 map/list 转换工具
  common/adapter.ts     Hexo 通用 adapter
  redefine/adapter.ts   Redefine 主题 adapter 示例

src/shared/customizeTypes.ts
  前后端共享的 manifest、panel、file、保存状态和结构化数据类型

src/worker/routes/customizeRoutes.ts
  设置 API 路由处理

src/pages/Customize*.tsx
  Hexo 设置、主题设置、结构化面板、Raw file editor
```

## Adapter 需要声明什么

每个 adapter 实现 `CustomizeAdapter`：

```ts
export type CustomizeAdapter = CustomizeAdapterSummary & {
  isEnabled: (context: CustomizeAdapterContext) => boolean
  files: CustomizeFileDescriptor[]
  panels: CustomizePanelDescriptor[]
  readPanel: (panelId: string, context: CustomizePanelReadContext) => unknown
  writePanel: (panelId: string, context: CustomizePanelWriteContext) => CustomizePanelWriteResult
}
```

核心字段：

- `id`：稳定 ID，例如 `butterfly`。
- `label`：显示名，例如 `Hexo Theme Butterfly`。
- `themeNames`：支持的主题名，例如 `['butterfly']`。
- `isEnabled`：判断是否启用。通常检查 `context.detectedTheme`。
- `files`：允许读取和保存的文件白名单。
- `panels`：提供哪些结构化编辑面板。
- `readPanel`：把源文件内容解析成前端可编辑数据。
- `writePanel`：把前端数据写回一个或多个文件内容。

## 文件描述符

文件描述符用于 manifest 和 Raw File Editor，也是 Worker 保存时的白名单。

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

注意：

- `id` 必须全局唯一。
- `path` 是博客仓库内的相对路径，不要以 `/` 开头。
- 不要把没有必要网页编辑的开发配置放进 `files`，否则 Raw editor 会暴露它。
- 如果某个面板依赖 `common` adapter 的文件，可以在 `fileIds` 里直接引用 `site-config`、`about-page`。

## 面板描述符

面板描述符决定 Hexo 设置或主题设置页如何展示功能入口。

```ts
const panels = [
  {
    id: 'butterfly-visual',
    adapterId: 'butterfly',
    title: 'Butterfly 视觉基础',
    description: '维护 favicon、avatar、主色和默认明暗模式。',
    group: 'visual' as const,
    fileIds: ['butterfly-config'],
  },
]
```

`group` 可选值：

```txt
basic
visual
navigation
pages
data
advanced
```

建议分组：

- `basic`：站点和主题基础信息。
- `visual`：颜色、图标、头像、Banner。
- `navigation`：导航栏、侧边栏、菜单链接。
- `pages`：About、page template、独立页面 front matter。
- `data`：`source/_data/*.yml` 这类结构化数据。
- `advanced`：只有高级用户才需要的兜底项。

## 读写上下文

`readPanel` 和 `writePanel` 会收到上下文：

```ts
type CustomizePanelReadContext = {
  detectedTheme?: string
  siteConfig: Record<string, unknown>
  themeConfig: Record<string, unknown>
  packageJson?: Record<string, unknown>
  files: Record<string, CustomizeFileState>
}
```

其中：

- `siteConfig` 来自 `_config.yml`。
- `themeConfig` 来自 `_config.<detectedTheme>.yml`，不存在时为空对象。
- `files` 只包含当前 panel 的 `fileIds` 依赖文件。
- `files[id].exists` 可以判断页面或数据文件是否已存在，适合提供创建能力。

## YAML 和 Markdown 工具

优先使用 `src/customize/yaml.ts` 的工具函数：

- `parseYamlRecord(content)`：解析 YAML object。
- `parseYaml<T>(content, fallback)`：解析任意 YAML。
- `stringifyYaml(value)`：稳定输出 YAML。
- `setYamlPaths(content, updates)`：尽量只更新指定 YAML path，适合 `_config.yml` 和主题配置。
- `parseMarkdownPage(markdown, path)`：拆分 front matter 和 body。
- `stringifyMarkdownPage(frontMatter, body)`：重新组合 front matter 和 body。
- `getRecord`、`getArray`、`getString`、`getNumber`、`getBoolean`：宽松读取未知数据。
- `linkMapToList` / `linkListToMap`：把主题配置里的链接 map 转成可排序列表，再写回 map。
- `mapToKeyValueItems` / `keyValueItemsToMap`：编辑社交链接、二维码等 key/value map。

写 `_config.yml`、`_config.<theme>.yml` 时优先使用 `setYamlPaths`，避免无意义重写整份配置。写 `_data/*.yml` 这类结构化数据时可以直接 `stringifyYaml`。

## 新增主题 adapter 步骤

以 Butterfly 为例：

1. 新建目录：

```txt
src/customize/butterfly/
  adapter.ts
```

2. 实现 adapter：

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
      title: 'Butterfly 视觉基础',
      description: '维护主题常用视觉配置。',
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

3. 注册 adapter：

```ts
// src/customize/registry.ts
import { butterflyAdapter } from './butterfly/adapter'

export const customizeAdapters: CustomizeAdapter[] = [
  commonAdapter,
  redefineAdapter,
  butterflyAdapter,
]
```

4. 给前端结构化面板加 UI。

当前前端的结构化 UI 在 `src/pages/CustomizePanelPage.tsx` 的 `PanelEditor` 中按 `panelId` 分发。新增面板后，需要新增对应 editor component：

```tsx
if (panelId === 'butterfly-visual') {
  return <ButterflyVisualEditor data={data as ButterflyVisualData} onChange={onChange} />
}
```

如果只是需要兜底编辑，不做结构化 UI，也可以只声明 `files`，这样 Raw File Editor 能编辑文件，但首页不会出现专属 panel。

5. 更新博客侧 admin-index 生成脚本摘要。

`tools/generate-admin-index.mjs` 会输出 v3 轻索引、`site` 和 `customize` 摘要。新增正式 adapter 后，如果需要在 Hexo 设置或主题设置页显示面板，也要把对应的 adapter id、panel id、editable file id/path/type/exists 摘要加进去。注意 admin-index 只放摘要，不放配置全文；具体文件内容仍由 `/api/customize/panel` 或 `/api/customize/file` 从 GitHub 源文件读取。

文章图片索引由 `public/admin-index/post-assets/<relativeId>.json` 这类 per-post asset shard 管理，不要把它建模到设置 adapter 能力里。

## 什么时候做结构化面板

适合做面板：

- 站点基础信息。
- 主题常用视觉配置。
- 菜单、导航、侧边栏链接。
- 首页 Banner 和社交链接。
- 独立页面 front matter 和正文。
- `source/_data/*.yml` 中日常维护的数据。

不建议做面板：

- 注入自定义 HTML / JS。
- CDN、构建插件、开发模式。
- 复杂评论系统 provider 的完整配置。
- 低频或高风险配置。

这类内容留给 Raw File Editor 或直接改仓库。

## 数据建模建议

主题配置常见有两种链接结构：

```yaml
links:
  Home:
    path: /
    icon: fa-house
```

前端需要排序时建议读成数组：

```ts
[
  { name: 'Home', path: '/', icon: 'fa-house' }
]
```

保存时再写回 map。这样可以在 UI 中做新增、删除、排序，同时尽量保持主题原本的 YAML 结构。

`source/_data/*.yml` 如果原本就是数组，可以直接用数组建模，保存时整份 `stringifyYaml`。

Markdown 页面统一使用：

```ts
type MarkdownPageData = {
  exists: boolean
  path: string
  frontMatter: Record<string, unknown>
  body: string
}
```

如果页面不存在，adapter 的 `readPanel` 应返回一个合理默认值，让用户保存时创建文件。

## 安全边界

- 只有 enabled adapters 声明的 `files` 能被 Raw File Editor 读写。
- Worker 保存时会再次按 `id` 查 descriptor，不接受前端直接传 repo path。
- Panel 保存只允许写回 `writePanel` 返回的 descriptor file id。
- 主题 adapter 不应该绕过 GitHub commit 服务，也不应该直接拼接任意用户输入为 repo path。

## 验证清单

新增 adapter 后至少验证：

- 博客构建出的 `admin-index.json` 中 `customize.detectedTheme` 能启用对应 adapter。
- `/api/index` 返回新 adapter、panel ids 和 file summaries。
- 每个 panel 的 GET 能返回结构化数据。
- 每个 panel 的 PUT 能生成 GitHub commit。
- Raw File Editor 能读写 adapter 声明文件。
- 保存后前端能按 `commitSha` 追踪部署。
- 部署成功后能重新读取线上 admin-index，并更新浏览器本地缓存。
- `pnpm typecheck` 通过。
- `pnpm build` 通过。

如果修改了博客侧 `tools/generate-admin-index.mjs`，还要在真实博客仓库运行一次：

```bash
node tools/generate-admin-index.mjs
```

确认 `public/admin-index.json` 中包含新的 `site` / `customize` 摘要，并且 `public/admin-index/post-assets/` 下仍正常生成文章图片 shard。
