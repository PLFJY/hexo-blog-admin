# hexo-blog-admin

简体中文 | [English](README.en.md)

`hexo-blog-admin` 是一个基于 Vite + React + TypeScript 的 Hexo 博客管理后台 MVP，运行在 Cloudflare Workers 上。

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

在 Cloudflare Workers Dashboard 的 Variables and Secrets 中配置这些变量：

```txt
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
POSTS_DIR
POST_ASSET_FOLDER
ASSET_MODE
ASSET_CACHE
R2_TEMP_PREFIX
BLOG_PUBLIC_URL
ADMIN_INDEX_PATH
WORKFLOW_FILE
```

MVP 默认值写在 `wrangler.jsonc` 中。当前兼容日期固定为 `2026-04-30`，这是已安装本地 Miniflare 运行时支持的最新日期；升级 Cloudflare 工具链后可以按需调高。

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

`wrangler.jsonc` 有意没有填写 KV namespace id。如果 Wrangler 在部署时要求 id，请把真实 id 补进去。

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
  - `/api/drafts`
  - `/api/deploy/latest`
- 缺少 Worker variables、secrets、KV、R2 bindings 时的 Setup Gate。
- 前后端复用的 TypeScript API 和领域类型。
- 面向文件夹分类文章和文章资源目录的 Hexo 路径工具函数。
- GitHub、KV、R2、indexer、deploy 服务骨架，便于后续继续实现。

## 后续路线

- 从 Hexo 构建产物生成并读取 `admin-index.json`。
- 添加 Markdown 草稿编辑器。
- 添加基于 R2 临时缓存的草稿图片上传 UI。
- 实现 GitHub batch commit 发布。
- 触发并监控 GitHub Actions 部署。
- 添加更完整的设置诊断和恢复流程。
