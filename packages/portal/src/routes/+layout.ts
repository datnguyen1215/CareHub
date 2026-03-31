import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

/** Disable SSR and prerendering for Capacitor compatibility. */
export const ssr = false;
export const prerender = false;

/** Routes under /login (no auth required). */
const LOGIN_ROUTES = ['/login'];

/**
 * Checks auth status by calling the backend API.
 * Returns true if authenticated, false otherwise.
 */
async function checkAuth(fetch: typeof globalThis.fetch): Promise<boolean> {
	try {
		const res = await fetch('/api/users/me', { credentials: 'include' });
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Client-side auth check that enforces auth state:
 * - Unauthenticated requests to protected routes → redirect to /login
 * - Authenticated requests to /login/* → redirect to /
 *
 * Auth state is verified by calling /api/users/me which returns 401
 * if the token cookie is missing or invalid.
 */
export const load: LayoutLoad = async ({ url, fetch }) => {
	const { pathname } = url;
	const isLoginRoute = LOGIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
	const isAuthenticated = await checkAuth(fetch);

	if (isLoginRoute && isAuthenticated) {
		// Already authenticated — send to dashboard
		throw redirect(302, '/');
	}

	if (!isLoginRoute && !isAuthenticated) {
		// Protected route but not authenticated
		throw redirect(302, '/login');
	}

	return {};
};
