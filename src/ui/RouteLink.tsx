import type { MouseEvent, ReactNode } from 'react'
import type { Navigate } from './App'
import { pathFor, type Route } from './routes'

/**
 * A real link (so it can be opened in a new tab, and search engines can follow
 * it) that navigates in-app when clicked normally.
 */
export function RouteLink({
  to,
  onNavigate,
  className,
  children,
}: {
  to: Route
  onNavigate: Navigate
  className?: string
  children: ReactNode
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onNavigate(to)
  }
  return (
    <a href={pathFor(to)} className={className} onClick={onClick}>
      {children}
    </a>
  )
}
