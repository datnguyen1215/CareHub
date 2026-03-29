/** Profile list endpoints — GET (list) and POST (create) for group profiles. */
import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { getMembership, getAdminMembership } from '$lib/server/authorization';
import { careProfiles } from '@carehub/shared';
import type { RequestHandler } from './$types';

/**
 * GET /api/groups/:groupId/profiles — List all profiles in a group.
 * Requires user to be a member of the group.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const groupId = event.params.groupId;

		const membership = await getMembership(user.userId, groupId);
		if (!membership) {
			error(403, { message: 'Forbidden' });
		}

		const profiles = await db
			.select()
			.from(careProfiles)
			.where(eq(careProfiles.group_id, groupId));

		return json(profiles);
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};

/**
 * POST /api/groups/:groupId/profiles — Create a new profile in a group.
 * Requires user to be an admin of the group.
 */
export const POST: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const groupId = event.params.groupId;

		const membership = await getAdminMembership(user.userId, groupId);
		if (!membership) {
			error(403, { message: 'Only admins can create profiles' });
		}

		const body = await event.request.json();
		const { name, date_of_birth, relationship, conditions } = body as {
			name?: string;
			date_of_birth?: string;
			relationship?: string;
			conditions?: string[];
		};

		if (!name || typeof name !== 'string' || !name.trim()) {
			error(400, { message: 'name is required' });
		}

		const [profile] = await db
			.insert(careProfiles)
			.values({
				group_id: groupId,
				name: name.trim(),
				date_of_birth: date_of_birth ?? null,
				relationship: relationship ?? null,
				conditions: Array.isArray(conditions) ? conditions : []
			})
			.returning();

		return json(profile, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};
