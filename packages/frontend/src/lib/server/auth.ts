/** Auth utilities — JWT verification and signing for SvelteKit. */
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
	throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface JwtPayload {
	userId: string;
	email: string;
}

/**
 * Verifies a JWT token and returns the payload.
 * @param {string} token - JWT token to verify
 * @returns {JwtPayload | null} Decoded payload or null if invalid
 */
export function verifyToken(token: string): JwtPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as JwtPayload;
	} catch {
		return null;
	}
}

/**
 * Signs a JWT payload.
 * @param {JwtPayload} payload - User identity payload
 * @returns {string} Signed JWT token
 */
export function signToken(payload: JwtPayload): string {
	return jwt.sign(payload, JWT_SECRET);
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
