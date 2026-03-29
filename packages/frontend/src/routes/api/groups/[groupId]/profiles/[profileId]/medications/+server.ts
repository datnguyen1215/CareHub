/** Medication list and create endpoints — GET and POST for medications. */
import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/auth';
import { getMembership, getProfile } from '$lib/server/authorization';
import { medications } from '@carehub/shared';
import type { RequestHandler } from './$types';

const VALID_SCHEDULE = ['morning', 'afternoon', 'evening', 'bedtime'];

/**
 * GET /api/groups/:groupId/profiles/:profileId/medications
 * List medications for a care profile.
 * Query params:
 *   - include_discontinued=true - Include discontinued medications (default: active only)
 */
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const { groupId, profileId } = event.params;
		const includeDiscontinued = event.url.searchParams.get('include_discontinued') === 'true';

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

		// Query medications
		const rows = includeDiscontinued
			? await db.select().from(medications).where(eq(medications.care_profile_id, profileId))
			: await db
					.select()
					.from(medications)
					.where(and(eq(medications.care_profile_id, profileId), eq(medications.status, 'active')));

		return json(rows);
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};

/**
 * POST /api/groups/:groupId/profiles/:profileId/medications
 * Create a new medication for a care profile.
 * Body:
 *   - name: string (required)
 *   - dosage: string (optional)
 *   - schedule: string[] (optional, filtered to valid values)
 *   - status: 'active' | 'discontinued' (optional, defaults to 'active')
 */
export const POST: RequestHandler = async (event) => {
	try {
		const user = requireAuth(event);
		const { groupId, profileId } = event.params;

		const body = await event.request.json();
		const { name, dosage, schedule, status } = body as {
			name?: string;
			dosage?: string;
			schedule?: string[];
			status?: string;
		};

		// Validate name
		if (!name || typeof name !== 'string' || !name.trim()) {
			error(400, { message: 'name is required' });
		}

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

		// Filter schedule to valid values
		const scheduleValue = Array.isArray(schedule)
			? schedule.filter((s) => VALID_SCHEDULE.includes(s))
			: [];

		// Insert medication
		const [medication] = await db
			.insert(medications)
			.values({
				care_profile_id: profileId,
				name: name.trim(),
				dosage: dosage ?? null,
				schedule: scheduleValue,
				status: status === 'discontinued' ? 'discontinued' : 'active'
			})
			.returning();

		return json(medication, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message === 'Unauthorized') {
			error(401, { message: 'Unauthorized' });
		}
		throw err;
	}
};
