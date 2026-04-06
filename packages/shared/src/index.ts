// Shared types, utilities, and schema for CareHub — used by portal, kiosk, and backend

/** Roles a user can have within a household */
export type UserRole = 'admin' | 'caregiver' | 'viewer'

/** A CareHub user account */
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  householdId: string | null
  createdAt: string
  updatedAt: string
}

/** A household groups users caring for a shared recipient */
export interface Household {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

/** A care recipient within a household */
export interface CareRecipient {
  id: string
  householdId: string
  name: string
  dateOfBirth: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** A task assigned to a caregiver */
export interface Task {
  id: string
  householdId: string
  careRecipientId: string | null
  assignedToId: string | null
  title: string
  description: string | null
  dueAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Device status values */
export type DeviceStatus = 'online' | 'offline'

/** Which application a release belongs to */
export type AppType = 'kiosk' | 'portal'

/** A kiosk device */
export interface Device {
  id: string
  deviceToken: string
  name: string
  status: DeviceStatus
  batteryLevel: number | null
  lastSeenAt: string | null
  pairedAt: string | null
  createdAt: string
  /** Semver string of the currently installed app version, as last reported by the device. Null until reported. */
  appVersion: string | null
}

/** A published APK release available for OTA distribution */
export interface AppRelease {
  id: string
  /** Which application this release targets */
  app: AppType
  /** Semver string, e.g. "1.2.0" */
  version: string
  /** Android versionCode — monotonically increasing, used to determine if an update is available */
  versionCode: number
  /** Server-side path to the stored APK file */
  filePath: string
  /** Size of the APK in bytes, for showing download progress */
  fileSize: number
  /** SHA-256 hex digest for integrity verification after download */
  checksum: string
  /** Optional release notes */
  notes: string | null
  createdAt: string
}

/** Device with assigned care profiles */
export interface DeviceWithProfiles extends Device {
  profiles: {
    id: string
    name: string
    avatarUrl: string | null
  }[]
}

/** Device pairing token */
export interface DevicePairingToken {
  token: string
  expiresAt: string
}

// Re-export Drizzle schema
export * from './schema.js'

// Re-export WebRTC types, constants, and utilities
export * from './webrtc/index.js'

// Re-export WebSocket utilities
export * from './websocket/connection.js'

// Re-export logger
export { logger } from './logger.js'

// Re-export UI utilities
export * from './ui/toast.js'
