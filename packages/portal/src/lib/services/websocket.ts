/**
 * WebSocket client for real-time signaling communication.
 * Handles connection management, auto-reconnect, and message routing.
 */

import type { SignalingMessage } from '@carehub/shared'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

type MessageHandler = (message: SignalingMessage) => void
type ConnectionHandler = () => void

/** Reconnection configuration */
const INITIAL_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const RECONNECT_BACKOFF_MULTIPLIER = 2

/** WebSocket close codes */
const CLOSE_NORMAL = 1000
const CLOSE_AUTH_FAILED = 4001

let socket: WebSocket | null = null
let connectionState: ConnectionState = 'disconnected'
let reconnectAttempts = 0
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
let isUserInitiatedClose = false

const messageHandlers = new Set<MessageHandler>()
const connectHandlers = new Set<ConnectionHandler>()
const disconnectHandlers = new Set<ConnectionHandler>()

/**
 * Extracts JWT token from browser cookies.
 * @returns JWT token or null if not found
 */
function getJwtFromCookie(): string | null {
	const cookies = document.cookie.split(';')
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split('=')
		if (name === 'token' || name === 'auth_token') {
			return value
		}
	}
	return null
}

/**
 * Builds WebSocket URL with JWT authentication.
 * @returns WebSocket URL with jwt query parameter
 */
function buildWebSocketUrl(): string {
	const jwt = getJwtFromCookie()
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	const host = window.location.host
	return `${protocol}//${host}/ws?jwt=${jwt}`
}

/**
 * Calculates reconnect delay with exponential backoff.
 * @returns Delay in milliseconds
 */
function getReconnectDelay(): number {
	const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, reconnectAttempts)
	return Math.min(delay, MAX_RECONNECT_DELAY_MS)
}

/**
 * Schedules a reconnection attempt with exponential backoff.
 */
function scheduleReconnect(): void {
	if (isUserInitiatedClose) return
	if (reconnectTimeoutId) return

	const delay = getReconnectDelay()
	reconnectTimeoutId = setTimeout(() => {
		reconnectTimeoutId = null
		reconnectAttempts++
		connect()
	}, delay)
}

/**
 * Establishes WebSocket connection with JWT authentication.
 * Automatically handles reconnection on disconnect.
 */
export function connect(): void {
	if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
		return
	}

	const jwt = getJwtFromCookie()
	if (!jwt) {
		console.warn('[WebSocket] No JWT token found, cannot connect')
		connectionState = 'disconnected'
		return
	}

	isUserInitiatedClose = false
	connectionState = 'connecting'
	const url = buildWebSocketUrl()

	try {
		socket = new WebSocket(url)
	} catch (err) {
		console.error('[WebSocket] Failed to create WebSocket:', err)
		connectionState = 'disconnected'
		scheduleReconnect()
		return
	}

	socket.onopen = () => {
		connectionState = 'connected'
		reconnectAttempts = 0
		connectHandlers.forEach((handler) => handler())
	}

	socket.onclose = (event) => {
		connectionState = 'disconnected'
		socket = null
		disconnectHandlers.forEach((handler) => handler())

		// Handle auth failure - redirect to login
		if (event.code === CLOSE_AUTH_FAILED) {
			console.warn('[WebSocket] Authentication failed, redirecting to login')
			window.location.href = '/login'
			return
		}

		// Auto-reconnect unless user initiated close
		if (!isUserInitiatedClose && event.code !== CLOSE_NORMAL) {
			scheduleReconnect()
		}
	}

	socket.onerror = (event) => {
		console.error('[WebSocket] Connection error:', event)
	}

	socket.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data) as SignalingMessage
			messageHandlers.forEach((handler) => handler(message))
		} catch (err) {
			console.error('[WebSocket] Failed to parse message:', err)
		}
	}
}

/**
 * Cleanly closes the WebSocket connection.
 * Prevents auto-reconnect from triggering.
 */
export function disconnect(): void {
	isUserInitiatedClose = true

	if (reconnectTimeoutId) {
		clearTimeout(reconnectTimeoutId)
		reconnectTimeoutId = null
	}

	if (socket) {
		socket.close(CLOSE_NORMAL, 'User disconnected')
		socket = null
	}

	connectionState = 'disconnected'
	reconnectAttempts = 0
}

/**
 * Manually triggers reconnection.
 * Resets backoff counter for fresh reconnect attempt.
 */
export function reconnect(): void {
	disconnect()
	reconnectAttempts = 0
	isUserInitiatedClose = false
	connect()
}

/**
 * Returns current connection state.
 */
export function getConnectionState(): ConnectionState {
	return connectionState
}

/**
 * Sends a signaling message over WebSocket.
 * @param message - Message to send
 * @returns True if message was sent, false if not connected
 */
export function send(message: SignalingMessage): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		console.warn('[WebSocket] Cannot send message, not connected')
		return false
	}

	try {
		socket.send(JSON.stringify(message))
		return true
	} catch (err) {
		console.error('[WebSocket] Failed to send message:', err)
		return false
	}
}

/**
 * Subscribes to incoming messages.
 * @param handler - Function to call when message received
 * @returns Unsubscribe function
 */
export function onMessage(handler: MessageHandler): () => void {
	messageHandlers.add(handler)
	return () => {
		messageHandlers.delete(handler)
	}
}

/**
 * Subscribes to connection open events.
 * @param handler - Function to call when connected
 * @returns Unsubscribe function
 */
export function onConnect(handler: ConnectionHandler): () => void {
	connectHandlers.add(handler)
	return () => {
		connectHandlers.delete(handler)
	}
}

/**
 * Subscribes to connection close/error events.
 * @param handler - Function to call when disconnected
 * @returns Unsubscribe function
 */
export function onDisconnect(handler: ConnectionHandler): () => void {
	disconnectHandlers.add(handler)
	return () => {
		disconnectHandlers.delete(handler)
	}
}
