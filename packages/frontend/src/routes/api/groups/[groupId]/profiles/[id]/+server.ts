/** Profile detail endpoints — GET, PATCH, DELETE for individual profiles. */
import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { getMembership, getAdminMembership } from '$lib/server/authorization';
import { careProfiles } from '@carehub/shared';
import type { RequestHandler } from './$types';

/**
 * GET /api/groups/:groupId/profiles/:id — Fetch a specific profile.
 * Requires user to be a member of the group.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const groupId = event.params.groupId;
		const id = event.params.id;

		const membership = await getMembership(user.userId, groupId);
		if (!membership) {
			error(403, { message: 'Forbidden' });
		}

		const [profile] = await db
			.select()
			.from(careProfiles)
			.where(and(eq(careProfiles.id, id), eq(careProfiles.group_id, groupId)))
			.limit(1);

		if (!profile) {
			error(404, { message: 'Profile not found' });
		}

		return json(profile);
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};

/**
 * PATCH /api/groups/:groupId/profiles/:id — Update a profile.
 * Requires user to be an admin of the group.
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const groupId = event.params.groupId;
		const id = event.params.id;

		const membership = await getAdminMembership(user.userId, groupId);
		if (!membership) {
			error(403, { message: 'Only admins can update profiles' });
		}

		const body = await event.request.json();
		const { name, date_of_birth, relationship, conditions } = body as {
			name?: string;
			date_of_birth?: string | null;
			relationship?: string | null;
			conditions?: string[];
		};

		// Build partial update object
		const updates: Partial<{
			name: string;
			date_of_birth: string | null;
			relationship: string | null;
			conditions: string[];
			updated_at: Date;
		}> = { updated_at: new Date() };

		if (name !== undefined) {
			if (typeof name !== 'string' || !name.trim()) {
				error(400, { message: 'name cannot be empty' });
			}
			updates.name = name.trim();
		}
		if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth;
		if (relationship !== undefined) updates.relationship = relationship;
		if (conditions !== undefined) updates.conditions = Array.isArray(conditions) ? conditions : [];

		const [updated] = await db
			.update(careProfiles)
			.set(updates)
			.where(and(eq(careProfiles.id, id), eq(careProfiles.group_id, groupId)))
			.returning();

		if (!updated) {
			error(404, { message: 'Profile not found' });
		}

		return json(updated);
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};

/**
 * DELETE /api/groups/:groupId/profiles/:id — Delete a profile.
 * Requires user to be an admin of the group.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const groupId = event.params.groupId;
		const id = event.params.id;

		const membership = await getAdminMembership(user.userId, groupId);
		if (!membership) {
			error(403, { message: 'Only admins can delete profiles' });
		}

		const [deleted] = await db
			.delete(careProfiles)
			.where(and(eq(careProfiles.id, id), eq(careProfiles.group_id, groupId)))
			.returning();

		if (!deleted) {
			error(404, { message: 'Profile not found' });
		}

		return new Response(null, { status: 204 });
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};
