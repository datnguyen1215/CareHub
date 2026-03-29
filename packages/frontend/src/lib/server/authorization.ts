/** Authorization helpers — verify group membership and resource ownership. */
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { groupMembers, careProfiles } from '@carehub/shared';

/**
 * Get group membership for a user.
 * @param userId - User ID to check
 * @param groupId - Group ID to check membership in
 * @returns Group membership record or null if not a member
 */
export async function getMembership(userId: string, groupId: string) {
	const [membership] = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, userId)))
		.limit(1);

	return membership ?? null;
}

/**
 * Get profile by ID, verifying it belongs to the specified group.
 * @param profileId - Profile ID to fetch
 * @param groupId - Group ID the profile must belong to
 * @returns Profile record or null if not found or not in group
 */
export async function getProfile(profileId: string, groupId: string) {
	const [profile] = await db
		.select()
		.from(careProfiles)
		.where(and(eq(careProfiles.id, profileId), eq(careProfiles.group_id, groupId)))
		.limit(1);

	return profile ?? null;
}
