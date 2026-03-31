import 'dotenv/config'
import http from 'http'
import { createApp } from './app'
import { initWebSocketServer } from './websocket'
import { logger } from './services/logger'

const PORT = parseInt(process.env.PORT ?? '9391', 10)
const app = createApp()

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app)

// Initialize WebSocket server
initWebSocketServer(server)

server.listen(PORT, () => {
  logger.info(`CareHub backend listening on port ${PORT}`)
})
