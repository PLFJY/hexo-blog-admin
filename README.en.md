# hexo-blog-admin

English | [简体中文](README.md)

`hexo-blog-admin` is a Vite + React + TypeScript MVP for managing a Hexo blog from a Cloudflare Workers based admin app.

The intended data model is:

| Data | Storage |
| --- | --- |
| Published Markdown posts | GitHub repository |
| Published image assets | GitHub repository |
| Draft Markdown | Cloudflare KV |
| Temporary draft images | Cloudflare R2 |
| Draft image manifests | Cloudflare KV |
| Runtime configuration | Worker variables / KV |
| GitHub token | Worker secret |
| Build and deploy | GitHub Actions |
| Post index | Blog build artifact `admin-index.json` |

R2 is only a temporary draft cache, not the final image host.

## Install

```bash
pnpm install
```

## Local Development

```bash
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm build
```

Preview a production build:

```bash
pnpm preview
```

Deploy through Wrangler:

```bash
pnpm deploy
```

## GitHub Token

Use a fine-grained personal access token scoped to only the selected blog repository.

Recommended permissions:

```txt
Metadata: Read
Contents: Read and write
Actions: Read and write
```

Store the token as a Cloudflare Worker secret. Do not write it into repository files.

```bash
pnpm wrangler secret put GITHUB_TOKEN
```

## Worker Variables

Configure these Worker variables in Cloudflare Workers Dashboard under Variables and Secrets:

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

The default MVP values are listed in `wrangler.jsonc`. The compatibility date is pinned to `2026-04-30`, the latest date supported by the installed local Miniflare runtime; bump it after upgrading Cloudflare tooling if needed.

## KV And R2 Bindings

Create a KV namespace for admin state and drafts:

```bash
pnpm wrangler kv namespace create BLOG_ADMIN_KV
```

Create an R2 bucket for temporary draft assets:

```bash
pnpm wrangler r2 bucket create hexo-blog-admin-cache
```

Bind them as:

```txt
BLOG_ADMIN_KV
BLOG_ASSET_CACHE
```

`wrangler.jsonc` intentionally leaves the KV namespace id out. Add the real id before deployment if Wrangler requires it.

## Implemented MVP Features

- React 19 + Vite + TypeScript app shell.
- Fluent UI v9 dark themed layout with responsive `NavDrawer`.
- React Router routes for dashboard, posts, drafts, deploy, and settings.
- Chinese and English i18n with localStorage language preference.
- Cloudflare Worker APIs:
  - `/api/health`
  - `/api/setup/status`
  - `/api/github/repo`
  - `/api/index`
  - `/api/posts/tree`
  - `/api/drafts`
  - `/api/deploy/latest`
- Setup gate for missing Worker variables, secrets, KV, and R2 bindings.
- Shared TypeScript API/domain types.
- Hexo post path utility functions for folder-based post IDs and post-folder assets.
- GitHub, KV, R2, indexer, and deploy service skeletons for future implementation.

## Roadmap

- Generate and read `admin-index.json` from the Hexo build.
- Add Markdown draft editor.
- Add draft image upload UI backed by R2 temporary cache.
- Implement GitHub batch commit publishing.
- Trigger and monitor GitHub Actions deployments.
- Add richer settings diagnostics and recovery flows.
