import 'dotenv/config'
import http from 'http'
import { validateConfig, env } from './config/env.js'
import { createApp } from './app.js'
import { initWebSocketServer } from './websocket/index.js'
import { logger } from './services/logger.js'

validateConfig()
const app = createApp()

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app)

// Initialize WebSocket server
initWebSocketServer(server)

server.listen(env.PORT, () => {
  logger.info(`CareHub backend listening on port ${env.PORT}`)
})

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection')
})
