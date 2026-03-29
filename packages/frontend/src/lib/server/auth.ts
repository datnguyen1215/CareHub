/** Auth utilities — JWT verification and signing for SvelteKit. */
import jwt from 'jsonwebtoken';
import { json, type RequestEvent } from '@sveltejs/kit';

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
 * Returns user payload if authenticated, throws 401 error if not.
 * @param {RequestEvent} event - SvelteKit request event
 * @returns {JwtPayload} User payload
 * @throws {Response} 401 Unauthorized if not authenticated
 */
export function requireAuth(event: RequestEvent): JwtPayload {
	const token = event.cookies.get('token');
	if (!token) {
		throw json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = verifyToken(token);
	if (!user) {
		throw json({ error: 'Invalid token' }, { status: 401 });
	}

	return user;
}
