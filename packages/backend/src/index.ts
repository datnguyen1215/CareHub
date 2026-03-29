import express from 'express'
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

// Only start the server when this file is the entry point (not during tests)
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`CareHub API running on port ${env.PORT}`)
  })
}
