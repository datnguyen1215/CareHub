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

// Re-export UI utilities
export * from './ui/toast.js'
