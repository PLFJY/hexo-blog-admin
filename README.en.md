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

For local debugging, create `.dev.vars` in the project root. Do not commit this file:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=local-admin-password
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

## Troubleshooting

If direct navigation to `/posts` or refreshing `/posts/edit` shows Not Found, the SPA fallback is not active. This project uses Worker fallback, wrangler assets `single-page-application`, and Vite dev fallback together so direct route visits keep returning `index.html`.

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

Store the built-in admin username and password as Worker secrets too:

```bash
pnpm wrangler secret put ADMIN_USERNAME
pnpm wrangler secret put ADMIN_PASSWORD
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

`ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `GITHUB_TOKEN` are secrets and are not shown in the setup status. `ADMIN_USERNAME` is the built-in admin account. After logging in, add regular accounts from Settings; regular account passwords are stored in KV as salted hashes.

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

## Deployment Entrypoint

This project only supports deployment on a dedicated admin subdomain. The app runs at the root path `/`, and APIs are fixed under `/api/*`.

Cloudflare Worker route example:

```txt
admin.example.com/*
```

For the current deployment, use:

```txt
admin.blog.plfjy.top/*
```

Visit:

```txt
https://admin.blog.plfjy.top/
```

API paths:

```txt
/api/*
```

If you previously configured blog subpath routes such as `blog.plfjy.top/admin` or `blog.plfjy.top/admin/*`, remove them from Cloudflare Worker routes. The admin no longer supports being mounted under the blog subpath.

## Blog Repository admin-index.json Setup

The admin post list comes from the publicly deployed `admin-index.json` file on the blog site. Your Hexo blog repository needs to generate this file into `public/` and publish it together with the blog output.

Recommended script path:

```txt
tools/generate-admin-index.mjs
```

The script should scan:

```txt
source/_posts/**/*.md
```

And output:

```txt
public/admin-index.json
```

The index should contain at least:

```json
{
  "version": 1,
  "generatedAt": "2026-05-05T00:00:00.000Z",
  "postsDir": "source/_posts",
  "assetMode": "post-folder",
  "posts": [
    {
      "relativeId": "ap-csa/00-about-ap-csa",
      "title": "AP CSA 00 - About AP Computer Science A",
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

Add this script to the blog repository `package.json`:

```json
{
  "scripts": {
    "generate:admin-index": "node tools/generate-admin-index.mjs"
  }
}
```

Then run it in the blog repository GitHub Actions after the Hexo build and before Pages/static deployment:

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

After deployment, the blog should expose:

```txt
https://your-blog-domain/admin-index.json
```

Set `BLOG_PUBLIC_URL` and `ADMIN_INDEX_PATH` to match that URL:

```txt
BLOG_PUBLIC_URL=https://your-blog-domain
ADMIN_INDEX_PATH=/admin-index.json
```

## Implemented Features

- React 19 + Vite + TypeScript app shell.
- Fluent UI v9 dark themed layout with responsive `NavDrawer`.
- React Router routes for dashboard, posts, drafts, deploy, and settings.
- Chinese and English i18n with localStorage language preference.
- Cloudflare Worker APIs:
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
- Setup gate for missing Worker variables, secrets, KV, and R2 bindings.
- Dedicated admin login page backed by Worker Secrets `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- Account management in Settings; regular account passwords are stored in KV as salted hashes.
- Shared TypeScript API/domain types.
- Hexo post path utility functions for folder-based post IDs and post-folder assets.
- Reads `admin-index.json` from the blog site and shows the real post tree.
- Reads post Markdown through the GitHub REST API.
- Creates, saves, reads, and deletes drafts in KV.
- Provides live Markdown preview for post and draft editing, including `==highlight==` syntax.
- Uploads images from the Markdown editor into the R2 temporary cache and inserts the final Markdown image path.
- Manages draft image cache entries, including listing and deleting temporary R2 images.
- Publishes both Markdown and cached R2 draft images to the blog repository.
- Publishes drafts to the blog repository through a GitHub batch commit.
- Queries and dispatches the GitHub Actions deployment workflow.
