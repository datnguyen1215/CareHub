/** Backend-only timing and configuration constants. */

export const TIMEOUTS = {
  /** WebSocket ticket time-to-live (30 seconds). */
  WS_TICKET_TTL_MS: 30_000,

  /** Interval between expired WebSocket ticket cleanups (60 seconds). */
  WS_TICKET_CLEANUP_INTERVAL_MS: 60_000,

  /** Interval between device WebSocket ping frames (30 seconds). */
  DEVICE_PING_INTERVAL_MS: 30_000,

  /** OTP code validity window (15 minutes). */
  OTP_EXPIRATION_MS: 15 * 60 * 1000,

  /** Minimum seconds between OTP requests for the same email. */
  OTP_REQUEST_COOLDOWN_S: 60,

  /** Pairing token validity window (5 minutes). */
  PAIRING_TOKEN_EXPIRATION_MS: 5 * 60 * 1000,
} as const
