import express from 'express'
import { fileURLToPath } from 'url'
import { realpathSync } from 'fs'
import { env } from './config/env.js'
import { applyMiddleware } from './middleware/index.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'

export function createApp() {
  const app = express()

  applyMiddleware(app)

  app.use('/health', healthRouter)
  app.use('/auth', authRouter)

  return app
}

// Only start the server when this file is the entry point (not during tests).
// Using import.meta.url comparison is more robust than endsWith() — it handles
// compiled output, symlinks, and paths with unusual suffixes correctly.
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`CareHub API running on port ${env.PORT}`)
  })
}
