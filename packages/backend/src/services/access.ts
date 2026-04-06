/** Shared profile access-check utilities. */
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { careProfiles, profileShares } from '@carehub/shared'

// Infer the full row type returned by `db.select().from(careProfiles)`
type CareProfileRow = typeof careProfiles.$inferSelect

/**
 * Internal helper: look up profile + share in at most 2 queries.
 * Returns `null` when the user has no access at all.
 */
async function getProfileAccess(
  userId: string,
  profileId: string
): Promise<{ profile: CareProfileRow; role: 'owner' | 'admin' | 'viewer' } | null> {
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.id, profileId))
    .limit(1)

  if (!profile) return null

  if (profile.user_id === userId) {
    return { profile, role: 'owner' }
  }

  const [share] = await db
    .select()
    .from(profileShares)
    .where(and(eq(profileShares.profile_id, profileId), eq(profileShares.user_id, userId)))
    .limit(1)

  if (share) {
    return { profile, role: share.role as 'admin' | 'viewer' }
  }

  return null
}

/** Returns profile if user has any access (owner, admin, or viewer). */
export async function canAccessProfile(
  userId: string,
  profileId: string
): Promise<CareProfileRow | null> {
  const result = await getProfileAccess(userId, profileId)
  return result?.profile ?? null
}

/** Returns profile + role ('owner' | 'admin' | 'viewer'). */
export async function canViewProfile(
  userId: string,
  profileId: string
): Promise<{ profile: CareProfileRow; role: 'owner' | 'admin' | 'viewer' } | null> {
  return getProfileAccess(userId, profileId)
}

/** Returns profile + role only if user can edit (owner or admin). */
export async function canEditProfile(
  userId: string,
  profileId: string
): Promise<{ profile: CareProfileRow; role: 'owner' | 'admin' } | null> {
  const access = await canViewProfile(userId, profileId)
  if (!access) return null
  if (access.role === 'owner' || access.role === 'admin') {
    return access as { profile: CareProfileRow; role: 'owner' | 'admin' }
  }
  return null
}

/** Returns profile only if user is the owner (single query, no share lookup). */
export async function isProfileOwner(
  userId: string,
  profileId: string
): Promise<CareProfileRow | null> {
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.user_id, userId)))
    .limit(1)

  return profile ?? null
}
