import { useEffect } from 'react'
import { absoluteUrl, metaFor } from './pageMeta'
import type { Route } from './routes'

/** VITE_SITE_URL in production, else wherever the app is running. */
function siteUrl(): string {
  return import.meta.env.VITE_SITE_URL?.trim() || window.location.origin
}

function setContent(selector: string, value: string): void {
  document.querySelector(selector)?.setAttribute('content', value)
}

/**
 * Keeps the title, description, canonical URL and link-preview tags in step
 * with the screen, so each screen has its own (the prerendered pages already
 * have theirs; this covers moving around in the app).
 */
export function useDocumentMeta(route: Route): void {
  useEffect(() => {
    const meta = metaFor(route)
    const url = absoluteUrl(siteUrl(), meta.path)!
    document.title = meta.title
    setContent('meta[name="description"]', meta.description)
    setContent('meta[property="og:title"]', meta.title)
    setContent('meta[property="og:description"]', meta.description)
    setContent('meta[property="og:url"]', url)
    setContent('meta[name="twitter:title"]', meta.title)
    setContent('meta[name="twitter:description"]', meta.description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
  }, [route])
}
