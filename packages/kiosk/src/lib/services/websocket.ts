/** WebSocket service for real-time communication. */

import { getDeviceCredentials } from './storage';

type MessageHandler = (data: WsMessage) => void;

export interface WsMessage {
	type: string;
	payload?: unknown;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let messageHandlers: MessageHandler[] = [];

const RECONNECT_DELAY = 3000; // 3 seconds
const HEARTBEAT_INTERVAL = 25000; // 25 seconds

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let isConnected = false;

/**
 * Get the WebSocket URL.
 */
function getWsUrl(): string | null {
	const creds = getDeviceCredentials();
	if (!creds) return null;

	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const host = window.location.host;
	return `${protocol}//${host}/ws?token=${creds.deviceToken}`;
}

/**
 * Connect to WebSocket server.
 */
export function connect(): void {
	const url = getWsUrl();
	if (!url) {
		console.warn('Cannot connect WebSocket: no device credentials');
		return;
	}

	// Don't connect if already connected
	if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
		return;
	}

	try {
		ws = new WebSocket(url);

		ws.onopen = () => {
			console.log('WebSocket connected');
			isConnected = true;
			startHeartbeat();
		};

		ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as WsMessage;
				messageHandlers.forEach((handler) => handler(message));
			} catch (err) {
				console.error('Failed to parse WebSocket message:', err);
			}
		};

		ws.onclose = (event) => {
			console.log('WebSocket closed:', event.code, event.reason);
			isConnected = false;
			stopHeartbeat();
			scheduleReconnect();
		};

		ws.onerror = (err) => {
			console.error('WebSocket error:', err);
		};
	} catch (err) {
		console.error('Failed to create WebSocket:', err);
		scheduleReconnect();
	}
}

/**
 * Disconnect from WebSocket server.
 */
export function disconnect(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	stopHeartbeat();

	if (ws) {
		ws.onclose = null; // Prevent reconnect
		ws.close();
		ws = null;
	}

	isConnected = false;
}

/**
 * Schedule a reconnect attempt.
 */
function scheduleReconnect(): void {
	if (reconnectTimer) return;

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, RECONNECT_DELAY);
}

/**
 * Start heartbeat to keep connection alive.
 */
function startHeartbeat(): void {
	stopHeartbeat();
	heartbeatTimer = setInterval(() => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			send({ type: 'heartbeat', payload: {} });
		}
	}, HEARTBEAT_INTERVAL);
}

/**
 * Stop heartbeat timer.
 */
function stopHeartbeat(): void {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}
}

/**
 * Send a message to the server.
 * @param {WsMessage} message - Message to send
 */
export function send(message: WsMessage): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(message));
	}
}

/**
 * Add a message handler.
 * @param {MessageHandler} handler - Handler function
 * @returns {() => void} Unsubscribe function
 */
export function onMessage(handler: MessageHandler): () => void {
	messageHandlers.push(handler);
	return () => {
		messageHandlers = messageHandlers.filter((h) => h !== handler);
	};
}

/**
 * Check if WebSocket is connected.
 * @returns {boolean}
 */
export function getIsConnected(): boolean {
	return isConnected;
}
