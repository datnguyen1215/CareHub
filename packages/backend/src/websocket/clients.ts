/** WebSocket client registry — tracks connected devices and users. */
import { WebSocket } from 'ws'
import { logger } from '../services/logger'

/** Client type identifier */
export type ClientType = 'device' | 'user'

/** Connected client metadata */
export interface ConnectedClient {
  ws: WebSocket
  type: ClientType
  id: string
  connectedAt: Date
}

/** Registry key format: "device:{uuid}" or "user:{uuid}" */
type RegistryKey = `device:${string}` | `user:${string}`

/** Client registry — maps keys to arrays of connections (supports multiple tabs per user) */
const clientRegistry = new Map<RegistryKey, ConnectedClient[]>()

/**
 * Build registry key from client type and ID.
 */
const buildKey = (type: ClientType, id: string): RegistryKey =>
  `${type}:${id}` as RegistryKey

/**
 * Add a client connection to the registry.
 * Supports multiple connections per user (multiple tabs).
 */
export const addClient = (
  type: ClientType,
  id: string,
  ws: WebSocket
): ConnectedClient => {
  const key = buildKey(type, id)
  const client: ConnectedClient = {
    ws,
    type,
    id,
    connectedAt: new Date(),
  }

  const existing = clientRegistry.get(key) ?? []
  existing.push(client)
  clientRegistry.set(key, existing)

  logger.debug({ type, id, connections: existing.length }, 'Client added to registry')
  return client
}

/**
 * Remove a specific WebSocket connection from the registry.
 * For users with multiple tabs, only removes the matching connection.
 */
export const removeClient = (type: ClientType, id: string, ws: WebSocket): void => {
  const key = buildKey(type, id)
  const clients = clientRegistry.get(key)

  if (!clients) return

  const remaining = clients.filter((c) => c.ws !== ws)

  if (remaining.length === 0) {
    clientRegistry.delete(key)
    logger.debug({ type, id }, 'Client fully removed from registry')
  } else {
    clientRegistry.set(key, remaining)
    logger.debug({ type, id, connections: remaining.length }, 'Client connection removed')
  }
}

/**
 * Get all connections for a client.
 */
export const getClient = (type: ClientType, id: string): ConnectedClient[] | undefined => {
  const key = buildKey(type, id)
  return clientRegistry.get(key)
}

/**
 * Get the primary device connection (devices only have one connection).
 */
export const getDeviceClient = (deviceId: string): ConnectedClient | undefined => {
  const clients = getClient('device', deviceId)
  return clients?.[0]
}

/**
 * Get all user connections (may have multiple tabs).
 */
export const getUserClients = (userId: string): ConnectedClient[] => {
  return getClient('user', userId) ?? []
}

/**
 * Check if a device is connected.
 */
export const isDeviceConnected = (deviceId: string): boolean => {
  const client = getDeviceClient(deviceId)
  return client !== undefined && client.ws.readyState === WebSocket.OPEN
}

/**
 * Check if a user has any active connections.
 */
export const isUserConnected = (userId: string): boolean => {
  const clients = getUserClients(userId)
  return clients.some((c) => c.ws.readyState === WebSocket.OPEN)
}

/**
 * Send message to a specific device.
 * @returns true if message was sent
 */
export const broadcastToDevice = (deviceId: string, message: object): boolean => {
  const client = getDeviceClient(deviceId)
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message))
    return true
  }
  return false
}

/**
 * Send message to all connections for a user (all tabs).
 * @returns number of connections message was sent to
 */
export const broadcastToUser = (userId: string, message: object): number => {
  const clients = getUserClients(userId)
  const messageStr = JSON.stringify(message)
  let sent = 0

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr)
      sent++
    }
  }

  return sent
}

/**
 * Send message to all connected devices.
 */
export const broadcastToAllDevices = (message: object): void => {
  const messageStr = JSON.stringify(message)

  for (const [key, clients] of clientRegistry) {
    if (!key.startsWith('device:')) continue

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr)
      }
    }
  }
}

/**
 * Get count of connected devices.
 */
export const getConnectedDeviceCount = (): number => {
  let count = 0
  for (const key of clientRegistry.keys()) {
    if (key.startsWith('device:')) count++
  }
  return count
}

/**
 * Get count of connected users (unique users, not connections).
 */
export const getConnectedUserCount = (): number => {
  let count = 0
  for (const key of clientRegistry.keys()) {
    if (key.startsWith('user:')) count++
  }
  return count
}

/**
 * Get IDs of all currently connected users.
 */
export const getConnectedUserIds = (): string[] => {
  const ids: string[] = []
  for (const key of clientRegistry.keys()) {
    if (key.startsWith('user:')) {
      ids.push(key.slice('user:'.length))
    }
  }
  return ids
}

/**
 * Clear all connections (for shutdown).
 */
export const clearAllClients = (): void => {
  for (const clients of clientRegistry.values()) {
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1001, 'Server shutdown')
      }
    }
  }
  clientRegistry.clear()
}
