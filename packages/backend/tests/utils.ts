/**
 * Shared test utilities for backend tests.
 * Centralizes mock helpers and common test patterns.
 */
import { vi } from 'vitest'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'test-secret'

/**
 * Create an auth cookie for test requests.
 */
export function makeAuthCookie(userId = 'user-1', email = 'user@example.com'): string {
  const token = jwt.sign({ userId, email }, JWT_SECRET)
  return `token=${token}`
}

/**
 * Create a mock select chain that resolves after .limit() is called.
 */
export function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
}

/**
 * Create a mock select chain that resolves after .where() is called (no limit).
 * Used for aggregate queries or when no limit is needed.
 */
export function makeSelectChainResolvesOnWhere(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  }
}

/**
 * Create a mock insert chain.
 */
export function makeInsertChain(returning: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  }
  // values resolves to undefined when no returning() is called
  chain.values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(returning),
    then: vi.fn().mockImplementation((resolve: (v: undefined) => void) => resolve(undefined)),
  })
  return chain
}

/**
 * Create a mock update chain.
 */
export function makeUpdateChain(returning: unknown[]) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  }
}

/**
 * Create a mock delete chain.
 */
export function makeDeleteChain(returning: unknown[]) {
  return {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  }
}

/**
 * Type for the mock database object.
 * Note: createMockDb() cannot be used in vi.mock() factories because
 * vi.mock is hoisted and the function won't be available at that time.
 * Instead, inline the mock object directly in vi.mock() calls.
 */
export type MockDb = {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
  execute?: ReturnType<typeof vi.fn>
}
