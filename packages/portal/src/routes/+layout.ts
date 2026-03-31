import { redirect } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

/** Disable SSR and prerendering for Capacitor compatibility. */
export const ssr = false
export const prerender = false

/** Routes under /login (no auth required). */
const LOGIN_ROUTES = ['/login']

/**
 * Client-side auth check that enforces auth state:
 * - Unauthenticated requests to protected routes → redirect to /login
 * - Authenticated requests to /login/* → redirect to /
 *
 * Auth state is determined by the presence of the `token` cookie.
 * Full token validation happens on the backend; the client just checks
 * whether the cookie exists to avoid unnecessary redirects.
 */
export const load: LayoutLoad = ({ url }) => {
  const { pathname } = url

  // Check for token cookie (document.cookie is only available in browser)
  const hasToken =
    typeof document !== 'undefined' &&
    document.cookie.split('; ').some((c) => c.startsWith('token='))

  const isLoginRoute = LOGIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (isLoginRoute && hasToken) {
    // Already authenticated — send to dashboard
    throw redirect(302, '/')
  }

  if (!isLoginRoute && !hasToken) {
    // Protected route but not authenticated
    throw redirect(302, '/login')
  }

  return {}
}
