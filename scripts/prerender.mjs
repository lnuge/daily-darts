// Prerenders the static pages, sitemap.xml and robots.txt into dist/, after
// `vite build` (see src/prerender/site.tsx for what and why).
//
// It loads site.tsx through Vite (no Cloudflare plugin needed), so
// `import.meta.env` has the same VITE_* values as the app build: the
// .env files locally, the build variables on Cloudflare.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const vite = await createServer({
  root,
  configFile: false,
  mode: 'production',
  logLevel: 'error',
  appType: 'custom',
  plugins: [react()],
  server: { middlewareMode: true, hmr: false, ws: false },
})

try {
  const { buildSite } = await vite.ssrLoadModule('/src/prerender/site.tsx')
  const started = Date.now()
  const files = await buildSite({
    template: readFileSync(join(dist, 'index.html'), 'utf8'),
    nowMs: started,
  })
  for (const { file, contents } of files) {
    const path = join(dist, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, contents)
  }
  const pages = files.filter((f) => f.file.endsWith('.html')).length
  const sitemap = files.find((f) => f.file === 'sitemap.xml').contents
  console.log(`prerender: ${pages} pages, sitemap.xml and robots.txt in ${Date.now() - started} ms`)
  if (!sitemap.includes('<url>')) {
    console.warn(
      'prerender: VITE_SITE_URL is not set, so pages have no canonical URLs and the sitemap is empty.',
    )
  }
} finally {
  await vite.close()
}
