/** POST /api/auth/logout — clears the auth cookie. */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('token', { path: '/' });
	return json({ message: 'Logged out' });
};
