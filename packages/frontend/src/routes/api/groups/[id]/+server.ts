/** PATCH /api/groups/:id — rename a group (admin only). */
import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { groups, groupMembers } from '@carehub/shared';
import type { RequestHandler } from './$types';

/**
 * PATCH /api/groups/:id — update group name (admin only).
 * @returns {Response} Updated group or error
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const id = event.params.id;
		const body = await event.request.json();
		const { name } = body as { name?: string };

		if (!name || typeof name !== 'string' || !name.trim()) {
			error(400, { message: 'name is required' });
		}

		// Check the user is an admin of the group
		const [membership] = await db
			.select()
			.from(groupMembers)
			.where(and(eq(groupMembers.group_id, id), eq(groupMembers.user_id, user.userId)))
			.limit(1);

		if (!membership) {
			error(403, { message: 'Forbidden' });
		}

		if (membership.role !== 'admin') {
			error(403, { message: 'Only admins can rename the group' });
		}

		const [updated] = await db
			.update(groups)
			.set({ name: name.trim() })
			.where(eq(groups.id, id))
			.returning();

		if (!updated) {
			error(404, { message: 'Group not found' });
		}

		return json(updated);
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};
