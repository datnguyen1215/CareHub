/**
 * WebSocket client for real-time signaling communication.
 * Handles connection management, auto-reconnect, and message routing.
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

/** WebSocket close codes */
const CLOSE_NORMAL = 1000;
const CLOSE_AUTH_FAILED = 4001;
const CLOSE_INVALID_TICKET = 4004;

let socket: WebSocket | null = null;
let connectionState: ConnectionState = 'disconnected';
let reconnectAttempts = 0;
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isUserInitiatedClose = false;

const messageHandlers = new Set<MessageHandler>();
const connectHandlers = new Set<ConnectionHandler>();
const disconnectHandlers = new Set<ConnectionHandler>();

const reconnectStrategy = createReconnectStrategy({
	initialDelayMs: INITIAL_RECONNECT_DELAY_MS,
	maxDelayMs: MAX_RECONNECT_DELAY_MS,
	multiplier: RECONNECT_BACKOFF_MULTIPLIER
});

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
		connectHandlers.forEach((handler) => handler());
	};

	socket.onclose = (event) => {
		connectionState = 'disconnected';
		socket = null;
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
		if (message) {
			console.log('[WebSocket] Received:', message.type, message);
			messageHandlers.forEach((handler) => handler(message));
		}
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
 * Returns current connection state.
 */
export function getConnectionState(): ConnectionState {
	return connectionState;
}

/**
 * Sends a signaling message over WebSocket.
 * @param message - Message to send
 * @returns True if message was sent, false if not connected
 */
export function send(message: SignalingMessage): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		console.warn('[WebSocket] Cannot send message, not connected');
		return false;
	}

	try {
		socket.send(JSON.stringify(message));
		return true;
	} catch (err) {
		console.error('[WebSocket] Failed to send message:', err);
		return false;
	}
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
