/** Groups routes — list and create groups. */
import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { groups, groupMembers } from '@carehub/shared';
import type { RequestHandler } from './$types';

/**
 * GET /api/groups — list all groups the authenticated user belongs to.
 * @returns {Response} Array of groups
 */
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);

		const rows = await db
			.select({ group: groups })
			.from(groupMembers)
			.innerJoin(groups, eq(groupMembers.group_id, groups.id))
			.where(eq(groupMembers.user_id, user.userId));

		return json(rows.map((r) => r.group));
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};

/**
 * POST /api/groups — create a group and add the creator as admin.
 * @returns {Response} Created group with 201 status
 */
export const POST: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const body = await event.request.json();
		const { name } = body as { name?: string };

		if (!name || typeof name !== 'string' || !name.trim()) {
			error(400, { message: 'name is required' });
		}

		const group = await db.transaction(async (tx) => {
			const [created] = await tx.insert(groups).values({ name: name.trim() }).returning();

			await tx.insert(groupMembers).values({
				user_id: user.userId,
				group_id: created.id,
				role: 'admin'
			});

			return created;
		});

		return json(group, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};
