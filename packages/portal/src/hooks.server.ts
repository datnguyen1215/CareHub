import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

/** Routes under /login (no auth required). */
const LOGIN_ROUTES = ['/login'];

/**
 * Server hook that enforces auth state:
 * - Unauthenticated requests to protected routes → redirect to /login
 * - Authenticated requests to /login/* → redirect to /
 *
 * Auth state is determined by the presence of the `token` cookie.
 * Full token validation happens on the backend; the frontend just checks
 * whether the cookie exists to avoid unnecessary redirects.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const hasToken = !!event.cookies.get('token');

	const isLoginRoute = LOGIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

	if (isLoginRoute && hasToken) {
		// Already authenticated — send to dashboard
		throw redirect(302, '/');
	}

	if (!isLoginRoute && !hasToken) {
		// Protected route but not authenticated
		throw redirect(302, '/login');
	}

	return resolve(event);
};
