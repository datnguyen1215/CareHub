/** Individual medication endpoints — PATCH and DELETE for a specific medication. */
import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { getMembership, getProfile } from '$lib/server/authorization';
import { medications } from '@carehub/shared';
import type { RequestHandler } from './$types';

const VALID_SCHEDULE = ['morning', 'afternoon', 'evening', 'bedtime'];

/**
 * PATCH /api/groups/:groupId/profiles/:profileId/medications/:id
 * Update a medication.
 * Body (all optional):
 *   - name: string (cannot be empty if provided)
 *   - dosage: string | null
 *   - schedule: string[] (filtered to valid values)
 *   - status: 'active' | 'discontinued'
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const { groupId, profileId, id } = event.params;

		// Verify user is member of group
		const membership = await getMembership(user.userId, groupId);
		if (!membership) {
			error(403, { message: 'Forbidden' });
		}

		// Verify profile exists in group
		const profile = await getProfile(profileId, groupId);
		if (!profile) {
			error(404, { message: 'Profile not found' });
		}

		const body = await event.request.json();
		const { name, dosage, schedule, status } = body as {
			name?: string;
			dosage?: string | null;
			schedule?: string[];
			status?: string;
		};

		const updates: Partial<{
			name: string;
			dosage: string | null;
			schedule: string[];
			status: 'active' | 'discontinued';
			updated_at: Date;
		}> = { updated_at: new Date() };

		// Validate name if provided
		if (name !== undefined) {
			if (typeof name !== 'string' || !name.trim()) {
				error(400, { message: 'name cannot be empty' });
			}
			updates.name = name.trim();
		}

		// Update dosage if provided
		if (dosage !== undefined) {
			updates.dosage = dosage;
		}

		// Filter schedule if provided
		if (schedule !== undefined) {
			updates.schedule = Array.isArray(schedule)
				? schedule.filter((s) => VALID_SCHEDULE.includes(s))
				: [];
		}

		// Validate status if provided
		if (status !== undefined) {
			if (status !== 'active' && status !== 'discontinued') {
				error(400, { message: 'status must be active or discontinued' });
			}
			updates.status = status;
		}

		// Update medication
		const [updated] = await db
			.update(medications)
			.set(updates)
			.where(and(eq(medications.id, id), eq(medications.care_profile_id, profileId)))
			.returning();

		if (!updated) {
			error(404, { message: 'Medication not found' });
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
 * DELETE /api/groups/:groupId/profiles/:profileId/medications/:id
 * Delete a medication.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const { groupId, profileId, id } = event.params;

		// Verify user is member of group
		const membership = await getMembership(user.userId, groupId);
		if (!membership) {
			error(403, { message: 'Forbidden' });
		}

		// Verify profile exists in group
		const profile = await getProfile(profileId, groupId);
		if (!profile) {
			error(404, { message: 'Profile not found' });
		}

		// Delete medication
		const [deleted] = await db
			.delete(medications)
			.where(and(eq(medications.id, id), eq(medications.care_profile_id, profileId)))
			.returning();

		if (!deleted) {
			error(404, { message: 'Medication not found' });
		}

		return new Response(null, { status: 204 });
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};
