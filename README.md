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

本地调试可以在项目根目录创建 `.dev.vars`，这个文件不要提交：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=本地管理员密码
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

## Troubleshooting

如果直接访问 `/posts` 或刷新 `/posts/edit` 出现 Not Found，说明 SPA fallback 没生效。本项目通过 Worker fallback、wrangler assets `single-page-application`、Vite dev fallback 三层保证直达路由可用。

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

内置管理员账号和密码保存为 Worker Secret：

```bash
pnpm wrangler secret put ADMIN_USERNAME
pnpm wrangler secret put ADMIN_PASSWORD
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

`ADMIN_USERNAME`、`ADMIN_PASSWORD` 和 `GITHUB_TOKEN` 是 secret，不会显示在配置状态里。`ADMIN_USERNAME` 对应内置管理员账号；登录后台后可以在设置页新增普通账号，普通账号密码会以加盐哈希保存到 KV。

当前兼容日期固定为 `2026-04-30`，这是已安装本地 Miniflare 运行时支持的最新日期；升级 Cloudflare 工具链后可以按需调高。

## KV 和 R2 绑定

创建用于后台状态和草稿的 KV namespace。namespace 名字可以自定，但 Worker binding 名必须是 `BLOG_ADMIN_KV`：

```bash
pnpm wrangler kv namespace create BLOG_ADMIN_KV
```

创建用于草稿图片临时缓存的 R2 bucket。bucket 名字可以自定，但 Worker binding 名必须是 `BLOG_ASSET_CACHE`：

```bash
pnpm wrangler r2 bucket create hexo-blog-admin-cache
```

绑定名称如下：

```txt
BLOG_ADMIN_KV
BLOG_ASSET_CACHE
```

`wrangler.jsonc` 只声明代码需要的 binding 名，不指定你的 KV namespace id，也不指定你的 R2 bucket name。请在 Cloudflare Dashboard 的 Worker Bindings 里把你自己的 KV/R2 绑定到上面的名称。

KV/R2 binding 同样是必需项：没有绑定 `BLOG_ADMIN_KV` 或 `BLOG_ASSET_CACHE` 时，后台不会进入主界面。

## 部署入口

本项目只支持独立后台子域名部署，应用运行在根路径 `/`，API 固定为 `/api/*`。

Cloudflare Worker route 示例：

```txt
admin.example.com/*
```

你的实际部署可以使用：

```txt
admin.blog.plfjy.top/*
```

访问入口：

```txt
https://admin.blog.plfjy.top/
```

API 路径：

```txt
/api/*
```

如果以前配置过博客子路径 route，例如 `blog.plfjy.top/admin` 或 `blog.plfjy.top/admin/*`，可以从 Cloudflare Worker routes 中删除。后台不再支持挂载到博客子路径。

## 博客仓库侧配置 admin-index.json

后台的文章列表来自博客站点公开发布的 `admin-index.json`。你的 Hexo 博客仓库需要在构建产物 `public/` 中生成这个文件，并且在部署博客前把它一起发布出去。

推荐做法是在博客仓库新增一个脚本，例如：

```txt
tools/generate-admin-index.mjs
```

脚本需要扫描：

```txt
source/_posts/**/*.md
```

并输出：

```txt
public/admin-index.json
```

索引至少需要包含：

```json
{
  "version": 1,
  "generatedAt": "2026-05-05T00:00:00.000Z",
  "postsDir": "source/_posts",
  "assetMode": "post-folder",
  "posts": [
    {
      "relativeId": "ap-csa/00-about-ap-csa",
      "title": "AP CSA 00 - 关于AP Computer Science A",
      "path": "source/_posts/ap-csa/00-about-ap-csa.md",
      "folderPath": "ap-csa",
      "postSlug": "00-about-ap-csa",
      "assetDir": "source/_posts/ap-csa/00-about-ap-csa/",
      "markdownAssetPrefix": "00-about-ap-csa",
      "assets": [
        {
          "filename": "ap-csa-range.png",
          "repoPath": "source/_posts/ap-csa/00-about-ap-csa/ap-csa-range.png",
          "markdownPath": "00-about-ap-csa/ap-csa-range.png"
        }
      ]
    }
  ],
  "tree": []
}
```

在博客仓库 `package.json` 中添加：

```json
{
  "scripts": {
    "generate:admin-index": "node tools/generate-admin-index.mjs"
  }
}
```

然后在博客仓库的 GitHub Actions 中，放到 Hexo 构建之后、Pages/静态站点部署之前：

```yaml
- name: Build
  run: npm run build

- name: Generate admin index
  run: npm run generate:admin-index

- name: Deploy
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./public
```

这样部署后的博客应能访问：

```txt
https://你的博客域名/admin-index.json
```

后台的 `BLOG_PUBLIC_URL` 和 `ADMIN_INDEX_PATH` 需要对应这个地址，例如：

```txt
BLOG_PUBLIC_URL=https://你的博客域名
ADMIN_INDEX_PATH=/admin-index.json
```

## 已实现的功能

- React 19 + Vite + TypeScript 应用外壳。
- Fluent UI v9 深色主题布局和响应式 `NavDrawer`。
- Dashboard、Posts、Drafts、Deploy、Settings 的 React Router 路由。
- 中文和英文 i18n，支持 localStorage 语言偏好。
- Cloudflare Worker API：
  - `/api/health`
  - `/api/auth/status`
  - `/api/auth/login`
  - `/api/auth/logout`
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
- 独立管理员登录页，内置管理员账号来自 Worker Secret `ADMIN_USERNAME` / `ADMIN_PASSWORD`。
- 设置页账号管理，新增账号的密码以加盐哈希保存到 KV。
- 前后端复用的 TypeScript API 和领域类型。
- 面向文件夹分类文章和文章资源目录的 Hexo 路径工具函数。
- 从博客站点读取 `admin-index.json`，展示真实文章树。
- 通过 GitHub REST API 读取文章 Markdown。
- 基于 KV 的草稿创建、保存、读取和删除。
- 文章和草稿编辑时提供实时 Markdown 预览，并支持 `==高亮==` 语法。
- 在 Markdown 编辑器中上传图片到 R2 临时缓存，自动插入最终 Markdown 图片路径。
- 管理草稿图片缓存，支持查看和删除 R2 临时图片。
- 发布草稿时，将 Markdown 和 R2 中的草稿图片一起提交到博客仓库。
- 将草稿通过 GitHub batch commit 发布到博客仓库。
- 查询和触发 GitHub Actions 部署 workflow。
## admin-index 图片资源建议

建议博客侧在 `admin-index.json` 的每篇文章中提供 `assets` 数组，方便后台图片仓展示源站图片：

```ts
type PostAsset = {
  filename: string
  repoPath: string
  markdownPath: string
  size?: number
  publicUrl?: string
}
```

如果没有 `publicUrl`，后台会通过 GitHub contents API 读取 `repoPath` 生成受保护预览。
