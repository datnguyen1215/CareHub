/**
 * Lightweight logger that silences debug output in production builds.
 *
 * - `debug` / `info`: only logs when `import.meta.env?.DEV` is truthy (Vite dev mode).
 *   Falls back to `true` when `import.meta` is undefined (Node / tests) so that
 *   backend and test code keep logging unless explicitly disabled.
 * - `warn`: always logs.
 * - `error`: always logs (truly unexpected errors that should be visible).
 */

/** True when running inside a Vite dev server or build. */
function isDev(): boolean {
  try {
    // Vite sets import.meta.env.DEV to true in dev mode and false in production builds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env
    if (env && typeof env.DEV === 'boolean') return env.DEV
  } catch {
    // import.meta not available — assume non-Vite (Node / tests)
  }
  return true
}

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev()) console.log(...args)
  },

  info(...args: unknown[]): void {
    if (isDev()) console.log(...args)
  },

  warn(...args: unknown[]): void {
    if (isDev()) console.warn(...args)
  },

  /** Always logs — for truly unexpected errors. */
  error(...args: unknown[]): void {
    console.error(...args)
  },
} as const
