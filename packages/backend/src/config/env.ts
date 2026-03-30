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
} as const

export type Env = typeof env
