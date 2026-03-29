/** PATCH /api/groups/:id — rename a group (admin only). */
import { json } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { groups, groupMembers } from '@carehub/shared';
import type { RequestHandler } from './$types';

/**
 * PATCH /api/groups/:id — update group name (admin only).
 * @returns {Response} Updated group or error
 */
export const PATCH: RequestHandler = async (event): Promise<Response> => {
	try {
		const user = requireAuth(event);
		const id = event.params.id;
		const body = await event.request.json();
		const { name } = body as { name?: string };

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'name is required' }, { status: 400 });
		}

		// Check the user is an admin of the group
		const [membership] = await db
			.select()
			.from(groupMembers)
			.where(and(eq(groupMembers.group_id, id), eq(groupMembers.user_id, user.userId)))
			.limit(1);

		if (!membership) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		if (membership.role !== 'admin') {
			return json({ error: 'Only admins can rename the group' }, { status: 403 });
		}

		const [updated] = await db
			.update(groups)
			.set({ name: name.trim() })
			.where(eq(groups.id, id))
			.returning();

		if (!updated) {
			return json({ error: 'Group not found' }, { status: 404 });
		}

		return json(updated);
	} catch (err) {
		// If err is already a Response (from requireAuth), re-throw it
		if (err instanceof Response) {
			throw err;
		}
		console.error('PATCH /api/groups/:id error:', err);
		return json({ error: 'Failed to rename group' }, { status: 500 });
	}
};
