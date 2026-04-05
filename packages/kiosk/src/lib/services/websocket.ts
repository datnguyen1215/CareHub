/** WebSocket service for real-time communication. */

import { getDeviceCredentials } from './storage'
import { buildWsUrl, parseMessage, createFixedReconnectStrategy } from '@carehub/shared'
import type {
	IceCandidate,
	CallIncomingMessage,
	CallOfferMessage,
	IceCandidateMessage,
	CallEndedMessage,
	CallErrorMessage,
	ScreenShareStateMessage
} from '@carehub/shared'

type MessageHandler = (data: WsMessage) => void

export interface WsMessage {
	type: string
	payload?: unknown
}

/** Call message handlers for WebRTC signaling */
export interface CallMessageHandlers {
	onIncomingCall?: (message: CallIncomingMessage) => void
	onCallOffer?: (message: CallOfferMessage) => void
	onIceCandidate?: (message: IceCandidateMessage) => void
	onCallEnded?: (message: CallEndedMessage) => void
	onScreenShare?: (message: ScreenShareStateMessage) => void
	onCallError?: (message: CallErrorMessage) => void
}

let callHandlers: CallMessageHandlers = {}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let messageHandlers: MessageHandler[] = [];

const HEARTBEAT_INTERVAL = 25000; // 25 seconds

const reconnectStrategy = createFixedReconnectStrategy(3000);

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let isConnected = false;

/**
 * Get the WebSocket URL.
 * Device token in query param is acceptable for kiosk-only deployment;
 * tokens are device-bound and not user credentials.
 */
async function getWsUrl(): Promise<string | null> {
	const creds = await getDeviceCredentials();
	if (!creds) return null;

	return buildWsUrl({ token: creds.deviceToken });
}

/**
 * Connect to WebSocket server.
 */
export async function connect(): Promise<void> {
	const url = await getWsUrl();
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
			const message = parseMessage<WsMessage>(event.data);
			if (message) {
				// Route call signaling messages to dedicated handlers
				routeCallMessage(message)
				messageHandlers.forEach((handler) => handler(message))
			}
		}

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

	const delay = reconnectStrategy.getDelay(0);
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, delay);
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
	return isConnected
}

/**
 * Route call signaling messages to dedicated handlers.
 */
function routeCallMessage(message: WsMessage): void {
	switch (message.type) {
		case 'call:incoming':
			callHandlers.onIncomingCall?.(message as unknown as CallIncomingMessage)
			break
		case 'call:offer':
			callHandlers.onCallOffer?.(message as unknown as CallOfferMessage)
			break
		case 'call:ice-candidate':
			callHandlers.onIceCandidate?.(message as unknown as IceCandidateMessage)
			break
		case 'call:ended':
			callHandlers.onCallEnded?.(message as unknown as CallEndedMessage)
			break
		case 'call:screen-share':
			callHandlers.onScreenShare?.(message as unknown as ScreenShareStateMessage)
			break
		case 'call:error':
			callHandlers.onCallError?.(message as unknown as CallErrorMessage)
			break
	}
}

/**
 * Register handlers for call signaling messages.
 * @param {CallMessageHandlers} handlers - Call message handlers
 */
export function setCallHandlers(handlers: CallMessageHandlers): void {
	callHandlers = handlers
}

/**
 * Send call accepted message.
 * @param {string} callId - Call session ID
 */
export function sendCallAccepted(callId: string): void {
	send({ type: 'call:accepted', callId } as unknown as WsMessage)
}

/**
 * Send call declined message.
 * @param {string} callId - Call session ID
 */
export function sendCallDeclined(callId: string): void {
	send({ type: 'call:declined', callId } as unknown as WsMessage)
}

/**
 * Send SDP answer to caller.
 * @param {string} callId - Call session ID
 * @param {string} sdp - SDP answer string
 */
export function sendCallAnswer(callId: string, sdp: string): void {
	send({ type: 'call:answer', callId, sdp } as unknown as WsMessage)
}

/**
 * Send ICE candidate to caller.
 * @param {string} callId - Call session ID
 * @param {IceCandidate} candidate - ICE candidate
 */
export function sendIceCandidate(callId: string, candidate: IceCandidate): void {
	send({ type: 'call:ice-candidate', callId, candidate } as unknown as WsMessage)
}

/**
 * Send call ended message.
 * @param {string} callId - Call session ID
 */
export function sendCallEnded(callId: string): void {
	send({ type: 'call:ended', callId, reason: 'completed' } as unknown as WsMessage)
}
