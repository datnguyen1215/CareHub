/** Authorization helpers — verify group membership and resource ownership. */
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { groupMembers, careProfiles } from '@carehub/shared';

/**
 * Returns the membership record for a user in a group, or null if not a member.
 * @param {string} userId - User ID to check
 * @param {string} groupId - Group ID to check
 * @returns {Promise<typeof groupMembers.$inferSelect | null>} Membership record or null
 */
export async function getMembership(
	userId: string,
	groupId: string
): Promise<typeof groupMembers.$inferSelect | null> {
	const [membership] = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, userId)))
		.limit(1);

	return membership ?? null;
}

/**
 * Returns the membership record if user is an admin of the group, or null otherwise.
 * @param {string} userId - User ID to check
 * @param {string} groupId - Group ID to check
 * @returns {Promise<typeof groupMembers.$inferSelect | null>} Admin membership record or null
 */
export async function getAdminMembership(
	userId: string,
	groupId: string
): Promise<typeof groupMembers.$inferSelect | null> {
	const membership = await getMembership(userId, groupId);
	if (!membership || membership.role !== 'admin') {
		return null;
	}
	return membership;
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
