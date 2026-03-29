// Shared types for CareHub — used by both frontend and backend

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

// Re-export Drizzle schema
export * from './schema'
