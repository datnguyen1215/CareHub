/**
 * Factory functions for creating test data in the database.
 * These replace the mock chain helpers with real database inserts.
 */
import { db } from '../src/db'
import {
  users,
  careProfiles,
  profileShares,
  medications,
  events,
  journalEntries,
  attachments,
  devices,
  deviceAccess,
  deviceCareProfiles,
  devicePairingTokens,
} from '@carehub/shared'

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
 * Create a care profile in the test database.
 */
export async function createProfile(data: {
  id?: string
  user_id: string
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
 * Create a profile share in the test database.
 */
export async function createProfileShare(data: {
  profile_id: string
  user_id: string
  role: 'admin' | 'viewer'
}) {
  const [share] = await db.insert(profileShares).values(data).returning()
  return share
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

/**
 * Create an event in the test database.
 */
export async function createEvent(data: {
  id?: string
  care_profile_id: string
  title: string
  event_type: 'doctor_visit' | 'lab_work' | 'therapy' | 'general'
  event_date: Date | string
  location?: string | null
  notes?: string | null
}) {
  const [event] = await db.insert(events).values(data).returning()
  return event
}

/**
 * Create a journal entry in the test database.
 */
export async function createJournalEntry(data: {
  id?: string
  care_profile_id: string
  title: string
  content: string
  entry_date: string
  key_takeaways?: string | null
  linked_event_id?: string | null
  starred?: boolean
}) {
  const [entry] = await db.insert(journalEntries).values(data).returning()
  return entry
}

/**
 * Create an attachment in the test database.
 */
export async function createAttachment(data: {
  id?: string
  profile_id: string
  event_id?: string | null
  journal_id?: string | null
  file_url: string
  description?: string | null
  ocr_text?: string | null
  category: 'lab_result' | 'prescription' | 'insurance' | 'billing' | 'imaging' | 'other'
}) {
  const [attachment] = await db.insert(attachments).values(data).returning()
  return attachment
}

/**
 * Create a device in the test database.
 */
export async function createDevice(data: {
  id?: string
  device_token: string
  name: string
  status?: 'online' | 'offline'
  battery_level?: number | null
  last_seen_at?: Date | null
  paired_at?: Date | null
}) {
  const [device] = await db.insert(devices).values(data).returning()
  return device
}

/**
 * Grant a user access to a device.
 */
export async function createDeviceAccess(data: {
  device_id: string
  user_id: string
  granted_by?: string | null
}) {
  const [access] = await db.insert(deviceAccess).values(data).returning()
  return access
}

/**
 * Assign a care profile to a device.
 */
export async function createDeviceCareProfile(data: { device_id: string; care_profile_id: string }) {
  const [assignment] = await db.insert(deviceCareProfiles).values(data).returning()
  return assignment
}

/**
 * Create a device pairing token.
 */
export async function createDevicePairingToken(data: {
  token: string
  device_id?: string | null
  expires_at: Date
}) {
  const [pairingToken] = await db.insert(devicePairingTokens).values(data).returning()
  return pairingToken
}
