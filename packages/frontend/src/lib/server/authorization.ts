/** Authorization helpers — group membership verification for SvelteKit. */
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { groupMembers } from '@carehub/shared';

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
