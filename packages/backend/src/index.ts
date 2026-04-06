import 'dotenv/config'
import http from 'http'
import { validateConfig, env } from './config/env.js'
import { createApp } from './app.js'
import { initWebSocketServer } from './websocket/index.js'
import { clearAllClients } from './websocket/clients.js'
import { logger } from './services/logger.js'

validateConfig()
const app = createApp()

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app)

// Initialize WebSocket server
const wss = initWebSocketServer(server)

server.listen(env.PORT, () => {
  logger.info(`CareHub backend listening on port ${env.PORT}`)
})

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`)
  clearAllClients()
  wss.close()
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
  // Force exit if server hasn't closed within 5 seconds
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection')
})
