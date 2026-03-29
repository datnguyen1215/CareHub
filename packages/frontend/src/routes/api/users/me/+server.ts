/** User profile endpoints — GET and PATCH for authenticated user. */
import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { users } from '@carehub/shared';
import type { RequestHandler } from './$types';

/**
 * GET /api/users/me — Fetch current user profile.
 * Requires authentication via JWT cookie.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);

		const [userRecord] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);

		if (!userRecord) {
			error(404, { message: 'User not found' });
		}

		return json(userRecord);
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};

/**
 * PATCH /api/users/me — Update user profile (first_name, last_name).
 * Requires authentication via JWT cookie.
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);

		const body = await event.request.json();
		const { first_name, last_name } = body as { first_name?: string; last_name?: string };

		if (!first_name && !last_name) {
			error(400, { message: 'At least one of first_name or last_name is required' });
		}

		const [updatedUser] = await db
			.update(users)
			.set({ first_name, last_name })
			.where(eq(users.id, user.userId))
			.returning();

		if (!updatedUser) {
			error(404, { message: 'User not found' });
		}

		return json(updatedUser);
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};
