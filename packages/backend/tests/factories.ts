/**
 * Factory functions for creating test data in the database.
 * These replace the mock chain helpers with real database inserts.
 */
import { db } from '../src/db'
import { users, groups, groupMembers, careProfiles, medications } from '@carehub/shared'

/**
 * Create a user in the test database.
 */
export async function createUser(data: {
  id?: string
  email: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}) {
  const [user] = await db.insert(users).values(data).returning()
  return user
}

/**
 * Create a group in the test database.
 */
export async function createGroup(data: { id?: string; name: string }) {
  const [group] = await db.insert(groups).values(data).returning()
  return group
}

/**
 * Create a group membership in the test database.
 */
export async function createGroupMember(data: {
  user_id: string
  group_id: string
  role: 'admin' | 'viewer'
}) {
  const [member] = await db.insert(groupMembers).values(data).returning()
  return member
}

/**
 * Create a care profile in the test database.
 */
export async function createProfile(data: {
  id?: string
  group_id: string
  name: string
  avatar_url?: string | null
  date_of_birth?: string | null
  relationship?: string | null
  conditions?: string[]
}) {
  const [profile] = await db.insert(careProfiles).values(data).returning()
  return profile
}

/**
 * Create a medication in the test database.
 */
export async function createMedication(data: {
  id?: string
  care_profile_id: string
  name: string
  dosage?: string | null
  schedule?: string[]
  status?: 'active' | 'discontinued'
}) {
  const [medication] = await db.insert(medications).values(data).returning()
  return medication
}
