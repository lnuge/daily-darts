import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Fills %SITE_URL% in index.html from VITE_SITE_URL (e.g. https://daily-darts.com),
 * so link previews get the absolute URLs they need. Without it (local builds),
 * tags that need an absolute URL are dropped and the image path stays relative.
 */
function siteUrl(): Plugin {
  let url = ''
  return {
    name: 'daily-darts:site-url',
    configResolved(config) {
      url = (loadEnv(config.mode, config.envDir || config.root, 'VITE_').VITE_SITE_URL ?? '')
        .trim()
        .replace(/\/+$/, '')
    },
    transformIndexHtml(html) {
      if (!url) {
        html = html
          .replace(/\s*<link rel="canonical"[^>]*>/, '')
          .replace(/\s*<meta property="og:url"[^>]*>/, '')
      }
      return html.replaceAll('%SITE_URL%', url)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    siteUrl(),
    // Builds for Cloudflare Workers (see wrangler.jsonc) and runs `vite dev` /
    // `vite preview` in the real Workers runtime. Not needed for unit tests.
    ...(process.env.VITEST ? [] : [cloudflare()]),
  ],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'supabase/tests/**/*.test.ts'],
    environment: 'node',
  },
})
