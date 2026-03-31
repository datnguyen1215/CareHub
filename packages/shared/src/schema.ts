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
  integer,
} from 'drizzle-orm/pg-core'

// Enums
export const medicationStatusEnum = pgEnum('medication_status', ['active', 'discontinued'])
export const deviceStatusEnum = pgEnum('device_status', ['online', 'offline'])
export const eventTypeEnum = pgEnum('event_type', [
  'doctor_visit',
  'lab_work',
  'therapy',
  'general',
])
export const profileShareRoleEnum = pgEnum('profile_share_role', ['admin', 'viewer'])
export const attachmentCategoryEnum = pgEnum('attachment_category', [
  'lab_result',
  'prescription',
  'insurance',
  'billing',
  'imaging',
  'other',
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

// Care Profiles — now owned directly by users
export const careProfiles = pgTable('care_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name').notNull(),
  avatar_url: varchar('avatar_url'),
  date_of_birth: date('date_of_birth'),
  relationship: varchar('relationship'),
  conditions: text('conditions').array().default([]).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// Profile Shares — grants other users access to profiles
export const profileShares = pgTable(
  'profile_shares',
  {
    profile_id: uuid('profile_id')
      .notNull()
      .references(() => careProfiles.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: profileShareRoleEnum('role').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profile_id, table.user_id] }),
  })
)

// Medications
export const medications = pgTable('medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  care_profile_id: uuid('care_profile_id')
    .notNull()
    .references(() => careProfiles.id, { onDelete: 'cascade' }),
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
    .references(() => careProfiles.id, { onDelete: 'cascade' }),
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
      .references(() => careProfiles.id, { onDelete: 'cascade' }),
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

// Attachments
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id')
      .notNull()
      .references(() => careProfiles.id, { onDelete: 'cascade' }),
    event_id: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    journal_id: uuid('journal_id').references(() => journalEntries.id, { onDelete: 'cascade' }),
    file_url: varchar('file_url').notNull(),
    description: text('description'),
    ocr_text: text('ocr_text'),
    category: attachmentCategoryEnum('category').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    profileIdx: index('attachments_profile_idx').on(table.profile_id),
    eventIdx: index('attachments_event_idx').on(table.event_id),
    journalIdx: index('attachments_journal_idx').on(table.journal_id),
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

// Devices — kiosk tablets paired via QR code
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    device_token: varchar('device_token').notNull().unique(),
    name: varchar('name').notNull(),
    status: deviceStatusEnum('status').default('offline').notNull(),
    battery_level: integer('battery_level'),
    last_seen_at: timestamp('last_seen_at'),
    paired_at: timestamp('paired_at'),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index('devices_token_idx').on(table.device_token),
  })
)

// Device Care Profiles — links devices to care profiles they can access
export const deviceCareProfiles = pgTable(
  'device_care_profiles',
  {
    device_id: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    care_profile_id: uuid('care_profile_id')
      .notNull()
      .references(() => careProfiles.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.device_id, table.care_profile_id] }),
  })
)

// Device Access — tracks which caretakers can manage a device
export const deviceAccess = pgTable(
  'device_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    device_id: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    granted_by: uuid('granted_by').references(() => users.id),
    granted_at: timestamp('granted_at').defaultNow().notNull(),
  },
  (table) => ({
    deviceUserIdx: index('device_access_device_user_idx').on(table.device_id, table.user_id),
  })
)

// Device Pairing Tokens — temporary QR tokens for pairing
export const devicePairingTokens = pgTable(
  'device_pairing_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: varchar('token').notNull().unique(),
    device_id: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    expires_at: timestamp('expires_at').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index('device_pairing_tokens_token_idx').on(table.token),
  })
)
