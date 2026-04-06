/** WebSocket service for real-time communication. */

import { getDeviceCredentials } from './storage'
import { buildWsUrl, parseMessage, createFixedReconnectStrategy, logger } from '@carehub/shared'
import type {
	IceCandidate,
	CallIncomingMessage,
	CallOfferMessage,
	IceCandidateMessage,
	CallEndedMessage,
	CallErrorMessage,
	ScreenShareStateMessage
} from '@carehub/shared'
import { SilentUpdate } from '$lib/plugins/silent-update'
import { getCallState } from '$lib/stores/call'
import { setUpdateStatus, setUpdateProgress } from '$lib/stores/update'

type MessageHandler = (data: WsMessage) => void

export interface WsMessage {
	type: string
	payload?: unknown
}

/** Payload carried by an incoming `app:update` WebSocket message. */
export interface AppUpdatePayload {
	/** HTTPS URL of the APK to download. */
	downloadUrl: string;
	/** Lowercase hex SHA-256 checksum of the APK. */
	checksum: string;
	/** Human-readable version string of the update (e.g. "1.2.3"). */
	version: string;
	/** Backend release record ID. */
	releaseId: string;
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

/**
 * Cached app version retrieved once at startup via the SilentUpdate plugin.
 * Included in every heartbeat payload so the backend can track deployed versions.
 */
let cachedAppVersion: string | null = null;

/**
 * A pending app:update payload that arrived while a call was active.
 * Replayed once the call ends.
 */
let pendingUpdate: AppUpdatePayload | null = null;

/**
 * Guard flag — true while an OTA update is in progress.
 * Prevents a second concurrent update from starting if the backend
 * sends another `app:update` message before the first finishes.
 */
let isUpdating = false;

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
 * Fetch and cache the current app version from the native plugin.
 * Called once at connection time so the version is available for heartbeats.
 */
async function initVersion(): Promise<void> {
	try {
		const info = await SilentUpdate.getCurrentVersion();
		cachedAppVersion = info.version;
	} catch (err) {
		logger.warn('Could not fetch app version from SilentUpdate plugin:', err);
	}
}

/**
 * Connect to WebSocket server.
 * Fetches and caches the current app version on first call so heartbeats
 * include `appVersion` from the very first beat.
 */
export async function connect(): Promise<void> {
	// Fetch version once per session (no-op if already cached)
	if (!cachedAppVersion) {
		await initVersion();
	}

	const url = await getWsUrl();
	if (!url) {
		logger.warn('Cannot connect WebSocket: no device credentials');
		return;
	}

	// Don't connect if already connected
	if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
		return;
	}

	try {
		ws = new WebSocket(url);

		ws.onopen = () => {
			logger.debug('WebSocket connected');
			isConnected = true;
			startHeartbeat();
		};

		ws.onmessage = (event) => {
			const message = parseMessage<WsMessage>(event.data);
			if (message) {
				// Route call signaling messages to dedicated handlers
				routeCallMessage(message)
				// Route update messages to the update handler
				routeUpdateMessage(message)
				messageHandlers.forEach((handler) => handler(message))
			}
		}

		ws.onclose = (event) => {
			logger.debug('WebSocket closed:', event.code, event.reason);
			isConnected = false;
			stopHeartbeat();
			scheduleReconnect();
		};

		ws.onerror = (err) => {
			console.error('WebSocket error:', err);
		};
	} catch (err) {
		logger.error('Failed to create WebSocket:', err);
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
 * The payload includes `appVersion` so the backend can track deployed versions.
 */
function startHeartbeat(): void {
	stopHeartbeat();
	heartbeatTimer = setInterval(() => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			send({ type: 'heartbeat', payload: { appVersion: cachedAppVersion ?? undefined } });
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
 * Route OTA update messages to the update handler.
 *
 * If an `app:update` arrives while a call is active the payload is deferred
 * and replayed the next time this function is called outside of a call
 * (i.e. the handler is intentionally kept simple — deferred updates are
 * re-triggered via the call-ended path in call.ts which must call
 * `flushPendingUpdate()` when the call finishes).
 */
function routeUpdateMessage(message: WsMessage): void {
	if (message.type !== 'app:update') return;

	const payload = message.payload as AppUpdatePayload;
	const { status } = getCallState();
	const callIsActive = status === 'incoming' || status === 'connecting' || status === 'connected';

	if (callIsActive) {
		logger.info('[update] Call active — deferring app:update until call ends');
		pendingUpdate = payload;
		return;
	}

	if (isUpdating) {
		logger.warn('[update] Update already in progress — ignoring duplicate app:update message');
		return;
	}

	handleAppUpdate(payload);
}

/**
 * Flush a deferred update that arrived while a call was in progress.
 * Call this from the call store once the call has fully ended.
 */
export function flushPendingUpdate(): void {
	if (pendingUpdate) {
		if (isUpdating) {
			logger.warn('[update] Update already in progress — cannot flush deferred update yet');
			return;
		}
		const payload = pendingUpdate;
		pendingUpdate = null;
		logger.info('[update] Call ended — running deferred app:update');
		handleAppUpdate(payload);
	}
}

/**
 * Execute an OTA update:
 *  1. Report `downloading` status to the backend as progress events arrive.
 *  2. Report `success` with the new version on completion.
 *  3. Report `failed` with an error message on any error.
 *
 * Update flow:
 *   app:update (backend → kiosk)
 *     → app:update-status { status: 'downloading', progress } (kiosk → backend, repeated)
 *     → app:update-status { status: 'success', version }      (kiosk → backend, on install)
 *     → app:update-status { status: 'failed', error }         (kiosk → backend, on error)
 *
 * @param payload - Destructured fields from the incoming `app:update` message.
 */
async function handleAppUpdate(payload: AppUpdatePayload): Promise<void> {
	const { downloadUrl, checksum, version, releaseId } = payload;
	logger.info(`[update] Starting update to ${version} (release ${releaseId})`);

	isUpdating = true;
	setUpdateStatus('downloading', { updateProgress: 0 });

	// Listen for download progress events from the native plugin
	const progressListener = await SilentUpdate.addListener('downloadProgress', (event) => {
		const percent = event.percent >= 0 ? event.percent : 0;
		setUpdateProgress(percent);
		send({
			type: 'app:update-status',
			payload: { status: 'downloading', progress: percent, releaseId }
		});
	});

	try {
		await SilentUpdate.downloadAndInstall({ url: downloadUrl, checksum });

		// Download + install succeeded — transition to installing state
		setUpdateStatus('installing');

		// Refresh the cached version after a successful install
		try {
			const info = await SilentUpdate.getCurrentVersion();
			cachedAppVersion = info.version;
		} catch {
			// Non-fatal — version will be refreshed on next connect
		}

		setUpdateStatus('success');
		send({
			type: 'app:update-status',
			payload: { status: 'success', version, releaseId }
		});
		logger.info(`[update] Successfully installed version ${version}`);
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		setUpdateStatus('failed', { updateError: errorMessage });
		send({
			type: 'app:update-status',
			payload: { status: 'failed', error: errorMessage, releaseId }
		});
		logger.error('[update] Update failed:', errorMessage);
	} finally {
		await progressListener.remove();
		isUpdating = false;
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
