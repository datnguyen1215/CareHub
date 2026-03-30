import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  date,
  text,
  pgEnum,
  primaryKey,
  index,
  boolean,
} from 'drizzle-orm/pg-core'

// Enums
export const groupMemberRoleEnum = pgEnum('group_member_role', ['admin', 'viewer'])
export const medicationStatusEnum = pgEnum('medication_status', ['active', 'discontinued'])
export const eventTypeEnum = pgEnum('event_type', [
  'doctor_visit',
  'lab_work',
  'therapy',
  'general',
])

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email').notNull().unique(),
  first_name: varchar('first_name'),
  last_name: varchar('last_name'),
  avatar_url: varchar('avatar_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

// Groups
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

// Group Members
export const groupMembers = pgTable(
  'group_members',
  {
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    group_id: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    role: groupMemberRoleEnum('role').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.user_id, table.group_id] }),
  })
)

// Care Profiles
export const careProfiles = pgTable('care_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  group_id: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  name: varchar('name').notNull(),
  avatar_url: varchar('avatar_url'),
  date_of_birth: date('date_of_birth'),
  relationship: varchar('relationship'),
  conditions: text('conditions').array().default([]).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// Medications
export const medications = pgTable('medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  care_profile_id: uuid('care_profile_id')
    .notNull()
    .references(() => careProfiles.id),
  name: varchar('name').notNull(),
  dosage: varchar('dosage'),
  schedule: text('schedule').array().default([]).notNull(),
  status: medicationStatusEnum('status').default('active').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// Events
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  care_profile_id: uuid('care_profile_id')
    .notNull()
    .references(() => careProfiles.id),
  title: varchar('title').notNull(),
  event_type: eventTypeEnum('event_type').notNull(),
  event_date: timestamp('event_date').notNull(),
  location: varchar('location'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// Journal Entries
export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    care_profile_id: uuid('care_profile_id')
      .notNull()
      .references(() => careProfiles.id),
    title: varchar('title').notNull(),
    content: text('content').notNull(),
    key_takeaways: text('key_takeaways'),
    entry_date: date('entry_date').notNull(),
    // Nullable FK — journal entries exist independently; set to null when event is deleted
    linked_event_id: uuid('linked_event_id').references(() => events.id, { onDelete: 'set null' }),
    starred: boolean('starred').default(false).notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    profileIdx: index('journal_entries_profile_idx').on(table.care_profile_id),
    entryDateIdx: index('journal_entries_date_idx').on(table.entry_date),
  })
)

// OTP
export const otps = pgTable(
  'otps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email').notNull(),
    code: varchar('code', { length: 6 }).notNull(),
    expires_at: timestamp('expires_at').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    emailCodeIdx: index('otps_email_code_idx').on(table.email, table.code),
  })
)
