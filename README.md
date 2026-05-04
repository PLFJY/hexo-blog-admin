# hexo-blog-admin

简体中文 | [English](README.en.md)

`hexo-blog-admin` 是一个基于 Vite + React + TypeScript 的 Hexo 博客管理后台，运行在 Cloudflare Workers 上

目标数据模型如下：

| 数据 | 存储位置 |
| --- | --- |
| 正式 Markdown 文章 | GitHub 仓库 |
| 正式图片资源 | GitHub 仓库 |
| 草稿 Markdown | Cloudflare KV |
| 草稿图片临时缓存 | Cloudflare R2 |
| 草稿图片 manifest | Cloudflare KV |
| 运行时配置 | Worker Variables / KV |
| GitHub Token | Worker Secret |
| 构建和部署 | GitHub Actions |
| 文章索引 | 博客构建产物 `admin-index.json` |

R2 只作为草稿临时缓存，不作为正式图床。

## 安装

```bash
pnpm install
```

## 本地开发

```bash
pnpm dev
```

常用检查：

```bash
pnpm typecheck
pnpm build
```

预览生产构建：

```bash
pnpm preview
```

通过 Wrangler 部署：

```bash
pnpm deploy
```

## GitHub Token

建议使用 Fine-grained Personal Access Token，并且只授权选中的博客仓库。

推荐权限：

```txt
Metadata: Read
Contents: Read and write
Actions: Read and write
```

请把 token 保存为 Cloudflare Worker Secret，不要写入仓库文件。

```bash
pnpm wrangler secret put GITHUB_TOKEN
```

## Worker Variables

在 Cloudflare Workers Dashboard 的 Variables and Secrets 中配置这些变量。项目不在 `wrangler.jsonc` 写普通 `vars`，并且设置了 `keep_vars: true`，避免每次 `wrangler deploy` 覆盖你在 Cloudflare Dashboard 手动维护的值。

```txt
GITHUB_OWNER=PLFJY
GITHUB_REPO=blog
GITHUB_BRANCH=main
POSTS_DIR=source/_posts
BLOG_PUBLIC_URL=https://你的博客域名
ADMIN_INDEX_PATH=/admin-index.json
WORKFLOW_FILE=Build Pages.yml
```

变量用途：

| 变量 | 用途 |
| --- | --- |
| `GITHUB_OWNER` | 博客仓库所属账号或组织，例如 `PLFJY`。 |
| `GITHUB_REPO` | 博客仓库名，例如 `blog`。后台读取文章和发布草稿都会操作这个仓库。 |
| `GITHUB_BRANCH` | 博客仓库发布分支，例如 `main`。读取文章、提交草稿和触发 Action 都使用这个分支。 |
| `POSTS_DIR` | Hexo 文章目录，例如 `source/_posts`。用于计算 `relativeId` 对应的 Markdown 路径。 |
| `BLOG_PUBLIC_URL` | 已部署博客的公开地址。后台会从这里读取 `ADMIN_INDEX_PATH`。 |
| `ADMIN_INDEX_PATH` | 博客构建产物里的文章索引路径，例如 `/admin-index.json`。 |
| `WORKFLOW_FILE` | 博客仓库里负责构建部署的 GitHub Actions workflow 文件名，例如 `Build Pages.yml` 或 `deploy.yml`。 |

这些变量没有 fallback，也没有默认值。缺少任意一项时，后台会显示 SetupRequiredPage 并阻止进入主界面。

当前兼容日期固定为 `2026-04-30`，这是已安装本地 Miniflare 运行时支持的最新日期；升级 Cloudflare 工具链后可以按需调高。

## KV 和 R2 绑定

创建用于后台状态和草稿的 KV namespace：

```bash
pnpm wrangler kv namespace create BLOG_ADMIN_KV
```

创建用于草稿图片临时缓存的 R2 bucket：

```bash
pnpm wrangler r2 bucket create hexo-blog-admin-cache
```

绑定名称如下：

```txt
BLOG_ADMIN_KV
BLOG_ASSET_CACHE
```

`wrangler.jsonc` 可以保留 KV/R2 binding 声明。如果 Wrangler 在部署时要求 KV namespace id，请把真实 id 补进去。

KV/R2 binding 同样是必需项：没有绑定 `BLOG_ADMIN_KV` 或 `BLOG_ASSET_CACHE` 时，后台不会进入主界面。

## 已实现的 MVP 功能

- React 19 + Vite + TypeScript 应用外壳。
- Fluent UI v9 深色主题布局和响应式 `NavDrawer`。
- Dashboard、Posts、Drafts、Deploy、Settings 的 React Router 路由。
- 中文和英文 i18n，支持 localStorage 语言偏好。
- Cloudflare Worker API：
  - `/api/health`
  - `/api/setup/status`
  - `/api/github/repo`
  - `/api/index`
  - `/api/posts/tree`
  - `/api/posts/content`
  - `/api/drafts`
  - `/api/drafts/:id`
  - `/api/drafts/publish`
  - `/api/deploy/latest`
  - `/api/deploy/dispatch`
- 缺少 Worker variables、secrets、KV、R2 bindings 时的 Setup Gate。
- 前后端复用的 TypeScript API 和领域类型。
- 面向文件夹分类文章和文章资源目录的 Hexo 路径工具函数。
- 从博客站点读取 `admin-index.json`，展示真实文章树。
- 通过 GitHub REST API 读取文章 Markdown。
- 基于 KV 的草稿创建、保存、读取和删除。
- 将草稿通过 GitHub batch commit 发布到博客仓库。
- 查询和触发 GitHub Actions 部署 workflow。
- R2 草稿图片缓存服务骨架，便于后续接入图片上传 UI。

## 后续路线

- 添加基于 R2 临时缓存的草稿图片上传 UI。
- 添加更完整的 Markdown 编辑器体验。
- 发布后刷新博客索引并同步部署状态。
- 添加更完整的设置诊断和恢复流程。
