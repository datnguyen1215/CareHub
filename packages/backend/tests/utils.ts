/**
 * Shared test utilities for backend tests.
 */
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'test-secret'

/**
 * Create an auth cookie for test requests.
 */
export function makeAuthCookie(userId = 'user-1', email = 'user@example.com'): string {
  const token = jwt.sign({ userId, email }, JWT_SECRET)
  return `token=${token}`
}
