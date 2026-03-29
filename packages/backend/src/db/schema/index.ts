import { pgTable, uuid, varchar, text, timestamp, pgEnum, integer } from 'drizzle-orm/pg-core'

// --- Enums ---

export const userRoleEnum = pgEnum('user_role', ['admin', 'viewer'])

export const careProfileStatusEnum = pgEnum('care_profile_status', [
  'stable',
  'needs_attention',
  'recent_visit',
])

export const medicationStatusEnum = pgEnum('medication_status', ['active', 'discontinued'])

export const medicationScheduleEnum = pgEnum('medication_schedule', [
  'morning',
  'afternoon',
  'evening',
  'bedtime',
])

// --- Tables ---

/**
 * Users: authenticated caretakers with access to one or more households
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Households: groups of users caring for one or more care profiles
 */
export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * HouseholdMembers: join table linking users to households with a role
 */
export const householdMembers = pgTable('household_members', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull().default('viewer'),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
})

/**
 * CareProfiles: the people being cared for within a household
 */
export const careProfiles = pgTable('care_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  relationship: varchar('relationship', { length: 100 }),
  healthNotes: text('health_notes'),
  status: careProfileStatusEnum('status').notNull().default('stable'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Medications: prescriptions and supplements tracked per care profile
 */
export const medications = pgTable('medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id')
    .notNull()
    .references(() => careProfiles.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  dosage: varchar('dosage', { length: 100 }),
  frequency: varchar('frequency', { length: 100 }),
  schedule: medicationScheduleEnum('schedule'),
  prescribingDoctor: varchar('prescribing_doctor', { length: 255 }),
  status: medicationStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
