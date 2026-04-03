import 'dotenv/config'
import http from 'http'
import { validateConfig, env } from './config/env'
import { createApp } from './app'
import { initWebSocketServer } from './websocket'
import { logger } from './services/logger'

validateConfig()
const app = createApp()

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app)

// Initialize WebSocket server
initWebSocketServer(server)

server.listen(env.PORT, () => {
  logger.info(`CareHub backend listening on port ${env.PORT}`)
})
