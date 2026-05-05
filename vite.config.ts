import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

function shouldRewriteDevSpaRequest(url: string | undefined, method: string | undefined) {
  if (!url || method !== 'GET') return false

  const pathname = url.split('?')[0] || '/'
  return (
    pathname === '/login' ||
    pathname === '/posts' ||
    pathname.startsWith('/posts/') ||
    pathname === '/drafts' ||
    pathname.startsWith('/drafts/') ||
    pathname === '/cache' ||
    pathname === '/deploy' ||
    pathname === '/settings'
  )
}

function spaFallbackPlugin(): Plugin {
  return {
    name: 'hexo-blog-admin-spa-fallback',
    configureServer(server) {
      return () => {
        server.httpServer?.prependListener('request', (req: IncomingMessage) => {
          if (shouldRewriteDevSpaRequest(req.url, req.method)) {
            req.url = '/'
          }
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [spaFallbackPlugin(), react(), cloudflare()],
})
