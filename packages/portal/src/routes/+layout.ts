import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

/** Disable SSR and prerendering for Capacitor compatibility. */
export const ssr = false;
export const prerender = false;

/** Routes under /login (no auth required). */
const LOGIN_ROUTES = ['/login'];

/** User profile data from /api/users/me. */
interface UserProfile {
	first_name: string | null;
}

/**
 * Checks auth status by calling the backend API.
 * Returns user profile if authenticated, null otherwise.
 */
async function checkAuth(fetch: typeof globalThis.fetch): Promise<UserProfile | null> {
	try {
		const res = await fetch('/api/users/me', { credentials: 'include' });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

/**
 * Client-side auth check that enforces auth state:
 * - Unauthenticated requests to protected routes → redirect to /login
 * - Authenticated requests to /login/* → redirect to / (except /login/setup if profile incomplete)
 *
 * Auth state is verified by calling /api/users/me which returns 401
 * if the token cookie is missing or invalid.
 */
export const load: LayoutLoad = async ({ url, fetch }) => {
	const { pathname } = url;
	const isLoginRoute = LOGIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
	const user = await checkAuth(fetch);
	const isAuthenticated = user !== null;

	if (isLoginRoute && isAuthenticated) {
		// Allow /login/setup if profile is incomplete (no first_name)
		const isSetupRoute = pathname === '/login/setup';
		const profileIncomplete = !user.first_name;

		if (isSetupRoute && profileIncomplete) {
			// Let user complete setup
			return {};
		}

		// Already authenticated with complete profile — send to dashboard
		throw redirect(302, '/');
	}

	if (!isLoginRoute && !isAuthenticated) {
		// Protected route but not authenticated
		throw redirect(302, '/login');
	}

	return {};
};
