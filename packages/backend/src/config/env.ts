/**
 * Environment variable configuration for the backend.
 * Validates required variables at startup.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '9391'), 10),

  // Auth
  JWT_SECRET: optionalEnv('JWT_SECRET', ''),

  // Database
  DATABASE_URL: optionalEnv(
    'DATABASE_URL',
    'postgresql://carehub:carehub_dev@localhost:9392/carehub'
  ),
  DATABASE_URL_TEST: optionalEnv(
    'DATABASE_URL_TEST',
    'postgresql://carehub:carehub_dev@localhost:9392/carehub_test'
  ),

  // SMTP (Gmail)
  SMTP_HOST: optionalEnv('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
  SMTP_USER: optionalEnv('SMTP_USER', ''),
  SMTP_PASSWORD: optionalEnv('SMTP_PASSWORD', ''),
  SMTP_FROM: optionalEnv('SMTP_FROM', 'noreply@carehub.local'),

  // Logging
  LOG_LEVEL: optionalEnv('LOG_LEVEL', 'info'),
  LOG_FILE: optionalEnv('LOG_FILE', '/tmp/carehub/backend.log'),
  LOG_FORMAT: optionalEnv(
    'LOG_FORMAT',
    optionalEnv('NODE_ENV', 'development') === 'development' ? 'pretty' : 'json'
  ),

  // OCR Configuration
  OCR_PROVIDER: optionalEnv('OCR_PROVIDER', 'tesseract'), // 'google' or 'tesseract'
  // GOOGLE_APPLICATION_CREDENTIALS is read directly by @google-cloud/vision

  // AI Configuration
  AI_PROVIDER: optionalEnv('AI_PROVIDER', 'fallback'), // 'openai', 'anthropic', or 'fallback'
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY', ''),
  ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY', ''),
  OPENAI_MODEL: optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
  ANTHROPIC_MODEL: optionalEnv('ANTHROPIC_MODEL', 'claude-3-haiku-20240307'),

  // Release Storage
  // Directory where APK files are stored on disk. Must be outside the static web
  // directory to prevent direct URL access. Defaults to data/releases/ relative to CWD.
  RELEASES_DIR: optionalEnv('RELEASES_DIR', ''),
} as const

export type Env = typeof env

/**
 * Validates that all required environment variables are set.
 * Throws an aggregated error listing all missing variables.
 * Call this at startup, after dotenv loads.
 */
export const validateConfig = (): void => {
  const missing: string[] = []

  // JWT_SECRET required in all environments
  if (!env.JWT_SECRET) {
    missing.push('JWT_SECRET')
  }

  // Production-only checks
  if (env.NODE_ENV === 'production') {
    if (!env.DATABASE_URL) missing.push('DATABASE_URL')
    if (!env.SMTP_USER) missing.push('SMTP_USER')
    if (!env.SMTP_PASSWORD) missing.push('SMTP_PASSWORD')
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.\n` +
      `Please set these in your .env file or environment.`
    )
  }
}
