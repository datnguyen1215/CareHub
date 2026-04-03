/**
 * WebSocket test utilities for creating test servers and WS clients.
 */
import http from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { createApp } from '../../src/app'
import { initWebSocketServer } from '../../src/websocket'
import { clearAllClients } from '../../src/websocket/clients'
import { generateWsTicketForUser } from '../../src/routes/auth'

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret'

/**
 * Create a test HTTP+WS server on a random port.
 * Call `start()` to begin listening and `close()` to shut down.
 */
export function createTestServer() {
  const app = createApp()
  const server = http.createServer(app)
  initWebSocketServer(server)

  return {
    server,
    /** Start listening on a random port, returns the port number */
    async start(): Promise<number> {
      await new Promise<void>((resolve) => server.listen(0, resolve))
      const addr = server.address()
      if (addr === null || typeof addr === 'string') throw new Error('Unexpected server address')
      return addr.port
    },
    /** Shut down server and clear WS clients */
    async close(): Promise<void> {
      clearAllClients()
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}

export interface WsClientOptions {
  /** Auth token (device token via `token` param) */
  token?: string
  /** JWT string (via `jwt` param) */
  jwt?: string
  /** WS ticket (via `ticket` param) */
  ticket?: string
}

/**
 * Create a WebSocket client connected to the test server.
 * Resolves when the connection opens.
 */
export async function connectWs(port: number, opts: WsClientOptions = {}): Promise<WebSocket> {
  const params = new URLSearchParams()
  if (opts.token) params.set('token', opts.token)
  else if (opts.jwt) params.set('jwt', opts.jwt)
  else if (opts.ticket) params.set('ticket', opts.ticket)

  const url = `ws://127.0.0.1:${port}/ws?${params.toString()}`
  const ws = new WebSocket(url)

  return new Promise<WebSocket>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.terminate()
      reject(new Error('WebSocket connection timeout'))
    }, 5000)

    ws.addEventListener('open', () => {
      clearTimeout(timeout)
      resolve(ws)
    })

    ws.addEventListener('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

/**
 * Wait for the next message from a WebSocket, parsed as JSON.
 * Rejects if no message arrives within the timeout.
 */
export function waitForMessage<T = unknown>(ws: WebSocket, timeoutMs = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', handler)
      reject(new Error(`No message received within ${timeoutMs}ms`))
    }, timeoutMs)

    function handler(event: WebSocket.MessageEvent) {
      clearTimeout(timer)
      ws.removeEventListener('message', handler)
      try {
        resolve(JSON.parse(event.data.toString()) as T)
      } catch {
        reject(new Error('Failed to parse message as JSON'))
      }
    }

    ws.addEventListener('message', handler)
  })
}

/**
 * Wait for the WebSocket to close, returning { code, reason }.
 */
export function waitForClose(ws: WebSocket, timeoutMs = 3000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('close', handler)
      reject(new Error(`No close event within ${timeoutMs}ms`))
    }, timeoutMs)

    function handler(event: WebSocket.CloseEvent) {
      clearTimeout(timer)
      ws.removeEventListener('close', handler)
      resolve({ code: event.code, reason: event.reason })
    }

    ws.addEventListener('close', handler)
  })
}

/**
 * Close a WebSocket connection cleanly with a short timeout.
 */
export async function closeWs(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close()
    await waitForClose(ws, 2000).catch(() => {
      ws.terminate()
    })
  }
}

/**
 * Create a signed JWT for user WebSocket authentication.
 */
export function makeUserJwt(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET)
}

/**
 * Create a one-time WebSocket ticket for a user (for ticket-based WS auth tests).
 */
export function makeWsTicket(userId: string): string {
  return generateWsTicketForUser(userId)
}
