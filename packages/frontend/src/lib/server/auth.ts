/** Auth utilities — JWT verification and signing for SvelteKit. */
import jwt from 'jsonwebtoken';

export interface JwtPayload {
	userId: string;
	email: string;
}

/**
 * Get JWT secret with lazy initialization.
 * Throws error only when actually used, not at module load time.
 * This prevents SSR errors for routes that don't need auth.
 */
function getJwtSecret(): string {
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error('JWT_SECRET environment variable is required');
	}
	return secret;
}

/**
 * Verifies a JWT token and returns the payload.
 * @param {string} token - JWT token to verify
 * @returns {JwtPayload | null} Decoded payload or null if invalid
 */
export function verifyToken(token: string): JwtPayload | null {
	try {
		return jwt.verify(token, getJwtSecret()) as JwtPayload;
	} catch {
		return null;
	}
}

/**
 * Signs a JWT payload with 7 day expiration.
 * @param {JwtPayload} payload - User identity payload
 * @returns {string} Signed JWT token
 */
export function signToken(payload: JwtPayload): string {
	return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Extracts and verifies user from request cookies.
 * @param {Request} request - SvelteKit request object
 * @returns {JwtPayload | null} User payload or null if not authenticated
 */
export function getUserFromRequest(request: Request): JwtPayload | null {
	const cookieHeader = request.headers.get('cookie');
	if (!cookieHeader) return null;

	// Parse cookies manually
	const cookies = Object.fromEntries(
		cookieHeader.split(';').map((cookie) => {
			const [name, ...rest] = cookie.trim().split('=');
			return [name, rest.join('=')];
		})
	);

	const token = cookies.token;
	if (!token) return null;

	return verifyToken(token);
}

/**
 * Requires authentication for a SvelteKit route handler.
 * Reads token from cookies, verifies JWT, and returns user payload.
 * @param {import('@sveltejs/kit').RequestEvent} event - SvelteKit request event
 * @returns {JwtPayload} User payload
 * @throws {Error} Throws error with 401 status if not authenticated
 */
export function requireAuth(event: { cookies: { get: (name: string) => string | undefined } }): JwtPayload {
	const token = event.cookies.get('token');
	if (!token) {
		throw new Error('Unauthorized');
	}

	const payload = verifyToken(token);
	if (!payload) {
		throw new Error('Unauthorized');
	}

	return payload;
}
