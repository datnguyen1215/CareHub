/**
 * WebSocket client for real-time signaling communication.
 * Handles connection management, auto-reconnect, message routing,
 * heartbeat keep-alive, and message queuing during reconnect.
 * Uses ticket-based authentication to work with httpOnly cookies.
 */

import type { SignalingMessage } from '@carehub/shared';
import { buildWsUrl, createReconnectStrategy, parseMessage } from '@carehub/shared';
import { getWsTicket } from '$lib/api';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

type MessageHandler = (message: SignalingMessage) => void;
type ConnectionHandler = () => void;

/** Reconnection configuration */
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

/** Heartbeat configuration */
const HEARTBEAT_INTERVAL_MS = 25000; // 25 seconds — matches kiosk interval
const HEARTBEAT_TIMEOUT_MS = 5000; // 5 seconds to receive pong

/** Message queue configuration */
const MAX_QUEUE_SIZE = 50;
const MESSAGE_TTL_MS = 30000; // 30 seconds — discard stale messages on flush

/** WebSocket close codes */
const CLOSE_NORMAL = 1000;
const CLOSE_AUTH_FAILED = 4001;
const CLOSE_INVALID_TICKET = 4004;

let socket: WebSocket | null = null;
let connectionState: ConnectionState = 'disconnected';
let reconnectAttempts = 0;
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isUserInitiatedClose = false;

/** Heartbeat state */
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
let heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;

/** Message queue for buffering during reconnect */
interface QueuedMessage {
	message: SignalingMessage;
	queuedAt: number;
}
let pendingMessages: QueuedMessage[] = [];

const messageHandlers = new Set<MessageHandler>();
const connectHandlers = new Set<ConnectionHandler>();
const disconnectHandlers = new Set<ConnectionHandler>();

const reconnectStrategy = createReconnectStrategy({
	initialDelayMs: INITIAL_RECONNECT_DELAY_MS,
	maxDelayMs: MAX_RECONNECT_DELAY_MS,
	multiplier: RECONNECT_BACKOFF_MULTIPLIER
});

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Starts sending ping frames every HEARTBEAT_INTERVAL_MS.
 * If no pong response within HEARTBEAT_TIMEOUT_MS, considers connection dead.
 */
function startHeartbeat(): void {
	stopHeartbeat();
	heartbeatIntervalId = setInterval(() => {
		if (socket?.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: 'ping' }));
			// Clear any existing timeout before setting a new one
			// (prevents stale timeout from closing a healthy connection)
			if (heartbeatTimeoutId) {
				clearTimeout(heartbeatTimeoutId);
				heartbeatTimeoutId = null;
			}
			// Start timeout — if no pong within window, force reconnect
			heartbeatTimeoutId = setTimeout(() => {
				console.warn('[WebSocket] Heartbeat timeout — no pong received');
				// Close will trigger onclose → scheduleReconnect
				socket?.close(4000, 'Heartbeat timeout');
			}, HEARTBEAT_TIMEOUT_MS);
		}
	}, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stops heartbeat interval and any pending timeout.
 */
function stopHeartbeat(): void {
	if (heartbeatIntervalId) {
		clearInterval(heartbeatIntervalId);
		heartbeatIntervalId = null;
	}
	if (heartbeatTimeoutId) {
		clearTimeout(heartbeatTimeoutId);
		heartbeatTimeoutId = null;
	}
}

// ─── Message Queue ────────────────────────────────────────────────────────────

/**
 * Adds a message to the pending queue.
 * Drops oldest message if queue is at max capacity.
 */
function enqueueMessage(message: SignalingMessage): void {
	if (pendingMessages.length >= MAX_QUEUE_SIZE) {
		console.warn(
			'[WebSocket] Message queue full — dropping oldest message',
			pendingMessages[0].message.type
		);
		pendingMessages.shift();
	}

	pendingMessages.push({ message, queuedAt: Date.now() });
	console.warn('[WebSocket] Message queued:', message.type, `(${pendingMessages.length}/${MAX_QUEUE_SIZE})`);
}

/**
 * Sends all non-expired pending messages in order, then clears the queue.
 */
function flushMessageQueue(): void {
	if (pendingMessages.length === 0) return;

	const now = Date.now();
	const fresh = pendingMessages.filter((entry) => now - entry.queuedAt < MESSAGE_TTL_MS);
	const stale = pendingMessages.length - fresh.length;

	if (stale > 0) {
		console.warn(`[WebSocket] Discarding ${stale} stale message(s) from queue`);
	}

	for (const entry of fresh) {
		if (!socket || socket.readyState !== WebSocket.OPEN) break;
		try {
			socket.send(JSON.stringify(entry.message));
		} catch (err) {
			console.error('[WebSocket] Failed to send queued message:', err);
		}
	}

	console.log(`[WebSocket] Flushed ${fresh.length} queued message(s)`);
	pendingMessages = [];
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Schedules a reconnection attempt with exponential backoff.
 */
function scheduleReconnect(): void {
	if (isUserInitiatedClose) return;
	if (reconnectTimeoutId) return;

	const delay = reconnectStrategy.getDelay(reconnectAttempts);
	reconnectTimeoutId = setTimeout(() => {
		reconnectTimeoutId = null;
		reconnectAttempts++;
		connect();
	}, delay);
}

/**
 * Establishes WebSocket connection with ticket-based authentication.
 * Fetches a short-lived ticket from the server before connecting.
 * Automatically handles reconnection on disconnect.
 */
export async function connect(): Promise<void> {
	if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
		return;
	}

	isUserInitiatedClose = false;
	connectionState = 'connecting';

	// Fetch a one-time ticket for WebSocket authentication
	let ticket: string;
	try {
		const response = await getWsTicket();
		ticket = response.ticket;
	} catch (err) {
		console.warn('[WebSocket] Failed to get auth ticket, user may not be logged in');
		connectionState = 'disconnected';
		return;
	}

	const url = buildWsUrl({ ticket });

	try {
		socket = new WebSocket(url);
	} catch (err) {
		console.error('[WebSocket] Failed to create WebSocket:', err);
		connectionState = 'disconnected';
		scheduleReconnect();
		return;
	}

	socket.onopen = () => {
		console.log('[WebSocket] Connected');
		connectionState = 'connected';
		reconnectAttempts = 0;
		startHeartbeat();
		flushMessageQueue();
		connectHandlers.forEach((handler) => handler());
	};

	socket.onclose = (event) => {
		connectionState = 'disconnected';
		socket = null;
		stopHeartbeat();
		disconnectHandlers.forEach((handler) => handler());

		// Handle auth failure - redirect to login
		if (event.code === CLOSE_AUTH_FAILED || event.code === CLOSE_INVALID_TICKET) {
			console.warn('[WebSocket] Authentication failed, redirecting to login');
			window.location.href = '/login';
			return;
		}

		// Auto-reconnect unless user initiated close
		if (!isUserInitiatedClose && event.code !== CLOSE_NORMAL) {
			scheduleReconnect();
		}
	};

	socket.onerror = (event) => {
		console.error('[WebSocket] Connection error:', event);
	};

	socket.onmessage = (event) => {
		const message = parseMessage<SignalingMessage>(event.data);
		if (!message) return;

		// Handle pong response to heartbeat ping
		if ('type' in message && (message as { type: string }).type === 'pong') {
			if (heartbeatTimeoutId) {
				clearTimeout(heartbeatTimeoutId);
				heartbeatTimeoutId = null;
			}
			return;
		}

		console.log('[WebSocket] Received:', message.type, message);
		messageHandlers.forEach((handler) => handler(message));
	};
}

/**
 * Cleanly closes the WebSocket connection.
 * Prevents auto-reconnect from triggering.
 */
export function disconnect(): void {
	isUserInitiatedClose = true;

	if (reconnectTimeoutId) {
		clearTimeout(reconnectTimeoutId);
		reconnectTimeoutId = null;
	}

	stopHeartbeat();

	// Clear pending messages on intentional disconnect
	pendingMessages = [];

	if (socket) {
		socket.close(CLOSE_NORMAL, 'User disconnected');
		socket = null;
	}

	connectionState = 'disconnected';
	reconnectAttempts = 0;
}

/**
 * Manually triggers reconnection.
 * Resets backoff counter for fresh reconnect attempt.
 */
export function reconnect(): void {
	disconnect();
	reconnectAttempts = 0;
	isUserInitiatedClose = false;
	connect();
}

/**
 * Immediately reconnects, bypassing exponential backoff.
 * Preserves the pending message queue so queued messages survive the reconnect.
 * Used when tab becomes visible and connection needs urgent restore.
 */
export function immediateReconnect(): void {
	const savedQueue = [...pendingMessages];

	isUserInitiatedClose = true;

	if (reconnectTimeoutId) {
		clearTimeout(reconnectTimeoutId);
		reconnectTimeoutId = null;
	}

	stopHeartbeat();

	if (socket) {
		socket.close(CLOSE_NORMAL, 'Immediate reconnect');
		socket = null;
	}

	connectionState = 'disconnected';
	reconnectAttempts = 0;
	isUserInitiatedClose = false;

	// Restore queue — disconnect() clears it, but we need to preserve it
	pendingMessages = savedQueue;

	connect();
}

/**
 * Returns current connection state.
 */
export function getConnectionState(): ConnectionState {
	return connectionState;
}

/**
 * Sends a signaling message over WebSocket.
 * If disconnected, queues the message for delivery on reconnect.
 * @param message - Message to send
 * @returns True if message was sent immediately, false if queued or failed
 */
export function send(message: SignalingMessage): boolean {
	if (socket?.readyState === WebSocket.OPEN) {
		try {
			socket.send(JSON.stringify(message));
			return true;
		} catch (err) {
			console.error('[WebSocket] Failed to send message:', err);
			enqueueMessage(message);
			return false;
		}
	}

	// Queue for delivery on reconnect
	enqueueMessage(message);
	return false;
}

/**
 * Returns the number of messages currently in the pending queue.
 */
export function getPendingMessageCount(): number {
	return pendingMessages.length;
}

/**
 * Subscribes to incoming messages.
 * @param handler - Function to call when message received
 * @returns Unsubscribe function
 */
export function onMessage(handler: MessageHandler): () => void {
	messageHandlers.add(handler);
	return () => {
		messageHandlers.delete(handler);
	};
}

/**
 * Subscribes to connection open events.
 * @param handler - Function to call when connected
 * @returns Unsubscribe function
 */
export function onConnect(handler: ConnectionHandler): () => void {
	connectHandlers.add(handler);
	return () => {
		connectHandlers.delete(handler);
	};
}

/**
 * Subscribes to connection close/error events.
 * @param handler - Function to call when disconnected
 * @returns Unsubscribe function
 */
export function onDisconnect(handler: ConnectionHandler): () => void {
	disconnectHandlers.add(handler);
	return () => {
		disconnectHandlers.delete(handler);
	};
}
