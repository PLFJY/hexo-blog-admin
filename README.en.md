# hexo-blog-admin

English | [简体中文](README.md)

`hexo-blog-admin` is a Vite + React + TypeScript dashboard for managing a Hexo blog from a Cloudflare Workers based admin app.

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

Configure these Worker variables in Cloudflare Workers Dashboard under Variables and Secrets. The project does not write normal `vars` in `wrangler.jsonc`, and sets `keep_vars: true`, so `wrangler deploy` will not overwrite values maintained in the Cloudflare Dashboard.

```txt
GITHUB_OWNER=PLFJY
GITHUB_REPO=blog
GITHUB_BRANCH=main
POSTS_DIR=source/_posts
BLOG_PUBLIC_URL=https://your-blog-domain
ADMIN_INDEX_PATH=/admin-index.json
WORKFLOW_FILE=Build Pages.yml
```

Variable meanings:

| Variable | Purpose |
| --- | --- |
| `GITHUB_OWNER` | GitHub account or organization that owns the blog repository, for example `PLFJY`. |
| `GITHUB_REPO` | Blog repository name, for example `blog`. The admin reads posts and publishes drafts to this repository. |
| `GITHUB_BRANCH` | Blog repository branch, for example `main`. Post reads, draft commits, and workflow dispatches use this branch. |
| `POSTS_DIR` | Hexo posts directory, for example `source/_posts`. Used to calculate Markdown paths from `relativeId`. |
| `BLOG_PUBLIC_URL` | Public URL of the deployed blog. The admin reads `ADMIN_INDEX_PATH` from this site. |
| `ADMIN_INDEX_PATH` | Blog build artifact path for the post index, for example `/admin-index.json`. |
| `WORKFLOW_FILE` | GitHub Actions workflow filename in the blog repository, for example `Build Pages.yml` or `deploy.yml`. |

These variables have no fallback and no default value. If any required item is missing, the app shows SetupRequiredPage and blocks the main admin UI.

The compatibility date is pinned to `2026-04-30`, the latest date supported by the installed local Miniflare runtime; bump it after upgrading Cloudflare tooling if needed.

## KV And R2 Bindings

Create a KV namespace for admin state and drafts. The namespace name can be anything, but the Worker binding name must be `BLOG_ADMIN_KV`:

```bash
pnpm wrangler kv namespace create BLOG_ADMIN_KV
```

Create an R2 bucket for temporary draft assets. The bucket name can be anything, but the Worker binding name must be `BLOG_ASSET_CACHE`:

```bash
pnpm wrangler r2 bucket create hexo-blog-admin-cache
```

Bind them as:

```txt
BLOG_ADMIN_KV
BLOG_ASSET_CACHE
```

`wrangler.jsonc` only declares the binding names expected by the code. It does not specify your KV namespace id or R2 bucket name. Bind your own KV/R2 resources to the names above in the Cloudflare Dashboard.

KV/R2 bindings are required too: without `BLOG_ADMIN_KV` or `BLOG_ASSET_CACHE`, the admin UI will remain blocked.

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
  - `/api/posts/content`
  - `/api/drafts`
  - `/api/drafts/:id`
  - `/api/drafts/publish`
  - `/api/deploy/latest`
  - `/api/deploy/dispatch`
- Setup gate for missing Worker variables, secrets, KV, and R2 bindings.
- Shared TypeScript API/domain types.
- Hexo post path utility functions for folder-based post IDs and post-folder assets.
- Reads `admin-index.json` from the blog site and shows the real post tree.
- Reads post Markdown through the GitHub REST API.
- Creates, saves, reads, and deletes drafts in KV.
- Publishes drafts to the blog repository through a GitHub batch commit.
- Queries and dispatches the GitHub Actions deployment workflow.
- Keeps the R2 draft asset cache service skeleton ready for the image upload UI.

## Roadmap

- Add draft image upload UI backed by R2 temporary cache.
- Add a richer Markdown editing experience.
- Refresh the blog index and deployment status after publishing.
- Add richer settings diagnostics and recovery flows.
