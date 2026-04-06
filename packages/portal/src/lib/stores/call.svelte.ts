/**
 * Svelte 5 runes-based call state store for WebRTC video calling.
 * Uses hierarchical state machine for call lifecycle management.
 * Portal acts as caller (initiates calls to kiosk devices).
 */

import type { SignalingMessage, CallEndReason, IceCandidate } from '@carehub/shared';
import {
  getUserFriendlyError,
  getTopLevelState,
  createDurationTimer,
  logger
} from '@carehub/shared';
import {
	createMachine,
	createCallerMachineConfig,
	sharedAssignActions,
	callerAssignActions,
	CALL_EVENTS,
	logTransition,
	logWebRTCEvent,
	logCallLifecycle,
	type CallContext
} from '@carehub/shared/webrtc/call-state-machine';
import { CALL_SETUP_TIMEOUT_MS, RECONNECT_TIMEOUT_MS } from '@carehub/shared';
import * as websocket from '$lib/services/websocket';
import * as webrtc from '$lib/services/webrtc';
import { toast } from '$lib/stores/toast.svelte';

/** Call status representing the call lifecycle */
export type CallStatusType =
	| 'idle'
	| 'initiating'
	| 'ringing'
	| 'connecting'
	| 'connected'
	| 'ended'
	| 'failed';

/** Call state structure exposed to UI */
export interface CallState {
	status: CallStatusType;
	sessionId: string | null;
	targetDeviceId: string | null;
	targetDeviceName: string | null;
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
	startedAt: Date | null;
	duration: number;
	error: string | null;
	isMuted: boolean;
	isVideoOff: boolean;
	isScreenSharing: boolean;
}

/** Initial call state */
const initialState: CallState = {
	status: 'idle',
	sessionId: null,
	targetDeviceId: null,
	targetDeviceName: null,
	localStream: null,
	remoteStream: null,
	startedAt: null,
	duration: 0,
	error: null,
	isMuted: false,
	isVideoOff: false,
	isScreenSharing: false
};

/** Reactive call state using Svelte 5 runes */
export const callState = $state<CallState>({ ...initialState });

/**
 * MediaStream storage - kept outside state machine context because
 * hsmjs serializes context and converts MediaStream to empty objects.
 */
let storedLocalStream: MediaStream | null = null;
let storedRemoteStream: MediaStream | null = null;

/** Setup timeout timer for ICE connection establishment */
let setupTimerId: ReturnType<typeof setTimeout> | null = null;

/** Reconnect timer for ICE disconnection grace period */
let reconnectTimerId: ReturnType<typeof setTimeout> | null = null;

/** Duration timer from shared package */
const durationTimer = createDurationTimer((seconds) => {
	if (callState.status === 'connected') {
		callState.duration = seconds;
	}
});

/** State machine instance */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let machine: any = null;

/**
 * Maps state machine state to UI status.
 */
function mapMachineStateToStatus(machineState: string): CallStatusType {
	// Handle hierarchical states (e.g., "signaling.waitingForAccept")
	const topLevelState = getTopLevelState(machineState);

	switch (topLevelState) {
		case 'idle':
			return 'idle';
		case 'initiating':
			return 'initiating';
		case 'signaling':
			// waitingForAccept maps to "ringing"
			return 'ringing';
		case 'connecting':
			return 'connecting';
		case 'connected':
			return 'connected';
		case 'ending':
			return 'ended';
		case 'failed':
			return 'failed';
		default:
			return 'idle';
	}
}

/** Track the previous status to detect state changes */
let previousStatus: CallStatusType | null = null;

/**
 * Syncs machine context to reactive callState.
 * Also emits toast notifications on error states.
 */
function syncStateFromMachine(state: string, context: CallContext): void {
	const newStatus = mapMachineStateToStatus(state);

	callState.status = newStatus;
	callState.sessionId = context.callId;
	callState.targetDeviceId = context.targetDeviceId;
	callState.targetDeviceName = context.targetDeviceName;
	// Use stored streams instead of context (hsmjs serializes MediaStream to {})
	callState.localStream = storedLocalStream;
	callState.remoteStream = storedRemoteStream;
	callState.startedAt = context.startedAt;
	callState.duration = context.duration;
	callState.error = context.error;
	callState.isMuted = context.isMuted;
	callState.isVideoOff = context.isVideoOff;

	// Emit toast on transition to failed state (only once)
	if (newStatus === 'failed' && previousStatus !== 'failed') {
		const userMessage = getUserFriendlyError(context.error);
		toast.error(userMessage);
	}

	previousStatus = newStatus;
}

/**
 * Updates the duration counter every second when connected.
 */
function startDurationTimer(): void {
	if (callState.startedAt) {
		durationTimer.start(callState.startedAt);
	}
}

/**
 * Stops the duration counter.
 */
function stopDurationTimer(): void {
	durationTimer.stop();
}

/**
 * Creates and initializes the call state machine with Portal-specific actions.
 */
function createCallMachine() {
	const config = createCallerMachineConfig();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const actions: Record<string, any> = {
		// Shared assign actions
		...sharedAssignActions,
		...callerAssignActions,

		// Override assignRemoteStream to update reactive state directly
		assignRemoteStream: ({ event }: { event: { stream: MediaStream } }) => {
			storedRemoteStream = event.stream;
			callState.remoteStream = event.stream;
		},

		// Logging actions
		logTransition: ({ context, event }: { context: CallContext; event: { type: string } }) => {
			const currentState = machine?.state || 'unknown';
			logTransition(currentState, currentState, event.type);
		},
		logEnterIdle: () => logCallLifecycle('State', 'idle'),
		logEnterInitiating: () => logCallLifecycle('State', 'initiating'),
		logEnterWaitingForAccept: () => logWebRTCEvent('State', 'signaling.waitingForAccept'),
		logEnterCreatingOffer: () => logWebRTCEvent('State', 'signaling.creatingOffer'),
		logEnterExchangingIce: () => logWebRTCEvent('State', 'signaling.exchangingIce'),
		logEnterConnecting: () => logCallLifecycle('State', 'connecting'),
		logEnterConnected: () => logCallLifecycle('State', 'connected'),
		logEnterUnstable: () => logWebRTCEvent('State', 'connected.unstable'),
		logEnterEnding: () => logCallLifecycle('State', 'ending'),
		logEnterFailed: () => logCallLifecycle('State', 'failed'),

		// Media actions
		acquireLocalMedia: async () => {
			try {
				const stream = await webrtc.getLocalStream();
				// Store stream outside machine context (hsmjs serializes MediaStream to {})
				storedLocalStream = stream;
				machine.send(CALL_EVENTS.LOCAL_STREAM_READY, { stream });
			} catch (err) {
				const error = err as Error;
				machine.send(CALL_EVENTS.MEDIA_ERROR, { error: error.message });
			}
		},

		// Peer connection actions
		createPeerConnection: () => {
			logWebRTCEvent('Action', 'Creating peer connection');
			webrtc.createPeerConnection();
		},

		// Signaling actions
		sendCallInitiate: ({ context }: { context: CallContext }) => {
			logCallLifecycle('Signaling', `Sending call:initiate to ${context.targetDeviceId}`);
			const sent = websocket.send({
				type: 'call:initiate',
				callId: context.callId!,
				deviceId: context.targetDeviceId!,
				profileId: null
			});
			if (!sent) {
				machine.send(CALL_EVENTS.CALL_ERROR, {
					error: 'Unable to connect. Please check your internet connection and try again.'
				});
			}
		},

		// SDP actions
		createAndSendOffer: async ({ context }: { context: CallContext }) => {
			try {
				logWebRTCEvent('SDP', 'Creating offer');
				const sdp = await webrtc.createOffer();
				logWebRTCEvent('Signaling', 'Sending call:offer');
				websocket.send({
					type: 'call:offer',
					callId: context.callId!,
					sdp
				});
				machine.send(CALL_EVENTS.OFFER_CREATED);
			} catch (err) {
				const error = err as Error;
				machine.send(CALL_EVENTS.CALL_ERROR, { error: error.message });
			}
		},

		handleAnswer: async ({ event }: { event: { sdp: string } }) => {
			try {
				logWebRTCEvent('SDP', 'Handling answer');
				await webrtc.handleAnswer(event.sdp);
			} catch (err) {
				const error = err as Error;
				machine.send(CALL_EVENTS.CALL_ERROR, { error: error.message });
			}
		},

		// ICE actions
		sendIceCandidate: ({ event }: { event: { candidate: IceCandidate } }) => {
			const context = machine.context as CallContext;
			if (context.callId) {
				logWebRTCEvent('ICE', 'Sending ICE candidate');
				websocket.send({
					type: 'call:ice-candidate',
					callId: context.callId,
					candidate: event.candidate
				});
			}
		},

		addRemoteIceCandidate: async ({ event }: { event: { candidate: IceCandidate } }) => {
			logWebRTCEvent('ICE', 'Adding remote ICE candidate');
			await webrtc.addIceCandidate(event.candidate);
		},

		flushPendingIceCandidates: async ({ context }: { context: CallContext }) => {
			for (const candidate of context.pendingIceCandidates) {
				try {
					logWebRTCEvent('ICE', 'Flushing pending ICE candidate');
					await webrtc.addIceCandidate(candidate);
				} catch (err) {
					logWebRTCEvent('ICE', `Failed to flush pending candidate: ${(err as Error).message}`);
				}
			}
		},

		queueIceCandidate: sharedAssignActions.queueIceCandidate,

		// Timer actions
		startDurationTimer: () => {
			startDurationTimer();
		},

		stopDurationTimer: () => {
			stopDurationTimer();
		},

		startSetupTimer: () => {
			if (setupTimerId) clearTimeout(setupTimerId);
			setupTimerId = setTimeout(() => {
				machine?.send(CALL_EVENTS.SETUP_TIMEOUT);
			}, CALL_SETUP_TIMEOUT_MS);
			logWebRTCEvent('Timer', `Setup timeout started (${CALL_SETUP_TIMEOUT_MS}ms)`);
		},

		clearSetupTimer: () => {
			if (setupTimerId) {
				clearTimeout(setupTimerId);
				setupTimerId = null;
			}
		},

		startReconnectTimer: () => {
			if (reconnectTimerId) clearTimeout(reconnectTimerId);
			reconnectTimerId = setTimeout(() => {
				machine?.send(CALL_EVENTS.RECONNECT_TIMEOUT);
			}, RECONNECT_TIMEOUT_MS);
			logWebRTCEvent('ICE', `Reconnect timer started (${RECONNECT_TIMEOUT_MS}ms)`);
		},

		clearReconnectTimer: () => {
			if (reconnectTimerId) {
				clearTimeout(reconnectTimerId);
				reconnectTimerId = null;
				logWebRTCEvent('ICE', 'Reconnect timer cleared');
			}
		},

		// Call end actions
		sendCallEnded: ({ context }: { context: CallContext }) => {
			if (context.callId) {
				logCallLifecycle('Signaling', 'Sending call:ended');
				websocket.send({
					type: 'call:ended',
					callId: context.callId,
					reason: 'completed'
				});
			}
		},

		// Cleanup actions
		cleanup: () => {
			logWebRTCEvent('Action', 'Cleaning up WebRTC resources');
			if (callState.isScreenSharing) {
				stopScreenShare();
			}
			webrtc.stopLocalStream();
			webrtc.closePeerConnection();
			// Clear stored streams
			storedLocalStream = null;
			storedRemoteStream = null;
			// Clear setup timeout timer
			if (setupTimerId) {
				clearTimeout(setupTimerId);
				setupTimerId = null;
			}
			// Clear reconnect timer
			if (reconnectTimerId) {
				clearTimeout(reconnectTimerId);
				reconnectTimerId = null;
			}
			queueMicrotask(() => {
				machine?.send(CALL_EVENTS.CLEANUP_COMPLETE);
			});
		},

		resetContext: sharedAssignActions.resetContext
	};

	machine = createMachine(config, { actions });

	// Subscribe to state changes to sync with reactive state
	machine.subscribe(({ nextState }: { nextState: { state: string; context: CallContext } }) => {
		syncStateFromMachine(nextState.state, nextState.context);
	});

	return machine;
}

/**
 * Initiates a call to a device.
 * @param deviceId - Target device ID
 * @param deviceName - Target device name for display
 */
export async function initiateCall(deviceId: string, deviceName: string): Promise<void> {
	if (!machine) {
		machine = createCallMachine();
	}

	// Guard: can only initiate from idle state
	if (!machine.matches('idle')) {
		logger.warn('[Call] Cannot initiate: not in idle state');
		toast.warning('A call is already in progress');
		return;
	}

	await machine.send(CALL_EVENTS.INITIATE, { deviceId, deviceName });
}

/**
 * Ends the current call.
 * @param _reason - Reason for ending (unused, always 'completed' for user-initiated)
 */
export function endCall(_reason: CallEndReason = 'completed'): void {
	if (!machine) return;

	// Guard: can only end if not already idle or ending
	if (machine.matches('idle') || machine.matches('ending')) {
		logger.warn('[Call] Cannot end: already idle or ending');
		return;
	}

	// Use CANCEL for pre-connected states, END for connected
	if (machine.matches('initiating') || machine.matches('signaling')) {
		machine.send(CALL_EVENTS.CANCEL);
	} else {
		machine.send(CALL_EVENTS.END);
	}
}

/**
 * Toggles local audio mute state.
 */
export function toggleMute(): void {
	callState.isMuted = !callState.isMuted;
	webrtc.setAudioEnabled(!callState.isMuted);
	logWebRTCEvent('Media', `Audio ${callState.isMuted ? 'muted' : 'unmuted'}`);
}

/**
 * Toggles local video on/off.
 */
export function toggleVideo(): void {
	callState.isVideoOff = !callState.isVideoOff;
	webrtc.setVideoEnabled(!callState.isVideoOff);
	logWebRTCEvent('Media', `Video ${callState.isVideoOff ? 'off' : 'on'}`);
}

// ─── Screen Share ──────────────────────────────────────────────────────────

/** Stores the original camera track so it can be restored after screen sharing. */
let originalCameraTrack: MediaStreamTrack | null = null;

/** The active screen stream, if any. */
let screenStream: MediaStream | null = null;

/** Guards against concurrent toggleScreenShare calls (e.g. rapid button taps). */
let screenShareInProgress = false;

/**
 * Stops screen sharing: restores the camera track, stops screen stream tracks,
 * resets state, and notifies the remote peer.
 */
function stopScreenShare(): void {
	const pc = webrtc.getPeerConnection();
	if (pc && originalCameraTrack) {
		const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
		if (sender) {
			sender.replaceTrack(originalCameraTrack).catch((err) => {
				logWebRTCEvent('Error', `Failed to restore camera track: ${(err as Error).message}`);
			});
		}
	}
	originalCameraTrack = null;

	if (screenStream) {
		screenStream.getTracks().forEach((t) => t.stop());
		screenStream = null;
	}

	callState.isScreenSharing = false;
	logWebRTCEvent('Media', 'Screen sharing stopped');

	if (callState.sessionId) {
		websocket.send({
			type: 'call:screen-share',
			callId: callState.sessionId,
			active: false
		});
	}
}

/**
 * Toggles screen sharing on/off during an active call.
 * Uses replaceTrack to swap the camera track for a screen capture track,
 * which does not require WebRTC renegotiation.
 */
export async function toggleScreenShare(): Promise<void> {
	if (callState.isScreenSharing) {
		stopScreenShare();
		return;
	}

	if (screenShareInProgress) return;
	screenShareInProgress = true;

	try {
		screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
		const screenTrack = screenStream.getVideoTracks()[0];

		const pc = webrtc.getPeerConnection();
		if (!pc) {
			screenStream.getTracks().forEach((t) => t.stop());
			screenStream = null;
			return;
		}

		const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
		if (!sender) {
			screenStream.getTracks().forEach((t) => t.stop());
			screenStream = null;
			return;
		}

		// Save the original camera track for restoration
		originalCameraTrack = sender.track ?? null;

		await sender.replaceTrack(screenTrack);

		// Listen for the user stopping share via browser/OS UI
		screenTrack.addEventListener('ended', () => {
			stopScreenShare();
		});

		callState.isScreenSharing = true;
		logWebRTCEvent('Media', 'Screen sharing started');

		if (callState.sessionId) {
			websocket.send({
				type: 'call:screen-share',
				callId: callState.sessionId,
				active: true
			});
		}
	} catch (err) {
		logWebRTCEvent('Error', `getDisplayMedia failed: ${(err as Error).message}`);
		toast.error('Unable to share screen. Permission denied or not supported.');
	} finally {
		screenShareInProgress = false;
	}
}

/**
 * Handles incoming signaling messages from WebSocket.
 * Routes messages to state machine events.
 * @param message - Signaling message from WebSocket
 */
export async function handleIncomingSignal(message: SignalingMessage): Promise<void> {
	logger.debug(
		'[Call] handleIncomingSignal:',
		message.type,
		'machine:',
		!!machine,
		'sessionId:',
		callState.sessionId
	);
	if (!machine) return;

	// Only process signals if this tab has an active call.
	// Prevents multi-tab interference — only the initiating tab is non-idle.
	if (callState.status === 'idle') {
		logger.warn('[Call] handleIncomingSignal: dropping message while idle, type:', message.type);
		return;
	}

	// Ignore messages for other calls (except call:ringing which establishes the session)
	if (
		'callId' in message &&
		message.type !== 'call:ringing' &&
		message.callId !== callState.sessionId
	) {
		logger.debug(
			'[Call] Ignoring message - callId mismatch:',
			(message as { callId: string }).callId,
			'!==',
			callState.sessionId
		);
		return;
	}

	logWebRTCEvent('Signaling', `Received ${message.type}`);

	switch (message.type) {
		case 'call:ringing':
			// Server confirms call initiated and provides the authoritative callId
			// Update both the UI state and the machine's context with the server's callId
			callState.sessionId = message.callId;
			machine.send(CALL_EVENTS.SESSION_CONFIRMED, { callId: message.callId });
			logCallLifecycle('Signaling', `Call ringing, sessionId updated to ${message.callId}`);
			break;

		case 'call:accepted':
			logCallLifecycle('Signaling', 'Call accepted by callee');
			machine.send(CALL_EVENTS.CALL_ACCEPTED);
			break;

		case 'call:declined':
			logCallLifecycle('Signaling', 'Call declined by callee');
			machine.send(CALL_EVENTS.CALL_DECLINED);
			break;

		case 'call:ended':
			logCallLifecycle('Signaling', `Call ended (reason: ${message.reason})`);
			machine.send(CALL_EVENTS.CALL_ENDED, { reason: message.reason });
			break;

		case 'call:answer':
			machine.send(CALL_EVENTS.ANSWER_RECEIVED, { sdp: message.sdp });
			break;

		case 'call:ice-candidate':
			machine.send(CALL_EVENTS.ICE_CANDIDATE, { candidate: message.candidate });
			break;

		case 'call:error':
			logCallLifecycle('Signaling', `Call error received: ${message.error}`);
			machine.send(CALL_EVENTS.CALL_ERROR, { error: message.error });
			break;
	}
}

/**
 * Sets up WebRTC event handlers.
 * Should be called once when the module loads.
 */
export function initializeCallHandlers(): () => void {
	// Initialize state machine
	machine = createCallMachine();

	// Handle remote track arrival
	const unsubTrack = webrtc.onTrack((stream) => {
		logWebRTCEvent('Track', 'Remote stream received');
		// Store stream outside machine context (hsmjs serializes MediaStream to {})
		storedRemoteStream = stream;
		machine.send(CALL_EVENTS.REMOTE_STREAM_READY, { stream });
	});

	// Handle ICE connection state changes
	const unsubState = webrtc.onConnectionStateChange((state) => {
		logWebRTCEvent('ICE', `Connection state: ${state}`);

		if (state === 'connected') {
			machine.send(CALL_EVENTS.ICE_CONNECTED);
		} else if (state === 'disconnected') {
			machine.send(CALL_EVENTS.ICE_DISCONNECTED);
		} else if (state === 'failed') {
			machine.send(CALL_EVENTS.ICE_FAILED);
		}
	});

	// Handle ICE candidates - send to state machine for forwarding
	const unsubIce = webrtc.onIceCandidate((candidate) => {
		logWebRTCEvent('ICE', 'Local ICE candidate gathered');
		machine.send(CALL_EVENTS.ICE_CANDIDATE, { candidate });
	});

	// Handle WebRTC errors
	const unsubError = webrtc.onError((error) => {
		logWebRTCEvent('Error', error);
		machine.send(CALL_EVENTS.CALL_ERROR, { error });
	});

	// Handle WebSocket messages
	const unsubMessage = websocket.onMessage((message) => {
		handleIncomingSignal(message);
	});

	// Handle WebSocket disconnections during calls
	const unsubDisconnect = websocket.onDisconnect(() => {
		// Only show warning if call is in progress
		if (
			callState.status === 'initiating' ||
			callState.status === 'ringing' ||
			callState.status === 'connecting' ||
			callState.status === 'connected'
		) {
			toast.warning('Connection lost. Reconnecting...');
		}
	});

	// Handle tab visibility changes during active calls
	const unsubVisibility = setupVisibilityHandler();

	// Return cleanup function
	return () => {
		unsubTrack();
		unsubState();
		unsubIce();
		unsubError();
		unsubMessage();
		unsubDisconnect();
		unsubVisibility();
		stopDurationTimer();
	};
}

// ─── Tab Visibility ───────────────────────────────────────────────────────────

/**
 * Whether the tab was hidden while a call was active.
 * Used to detect return from background during a call.
 */
let wasHiddenDuringCall = false;

/**
 * Checks if local media tracks are still live.
 * Browsers may pause tracks when tab goes to background.
 */
function areLocalTracksLive(): boolean {
	if (!storedLocalStream) return false;
	return storedLocalStream.getTracks().some((track) => track.readyState !== 'ended');
}

/**
 * Attempts to re-acquire the local media stream if tracks went dead
 * while the tab was in background. Stops the dead stream first to clear
 * the cache, acquires a fresh stream, then replaces tracks on the active
 * peer connection so the remote peer receives the new media.
 */
async function recoverLocalStream(): Promise<void> {
	if (!storedLocalStream || areLocalTracksLive()) return;

	logWebRTCEvent('Media', 'Local tracks appear dead — attempting recovery');

	try {
		// Stop the dead stream first to clear the cache in webrtc.getLocalStream()
		webrtc.stopLocalStream();

		// Acquire a fresh local stream
		const newStream = await webrtc.getLocalStream();
		storedLocalStream = newStream;
		callState.localStream = newStream;

		// Capture peer connection AFTER async getLocalStream to avoid stale reference
		const pc = webrtc.getPeerConnection();

		// Replace tracks on the active peer connection so remote peer gets new media
		if (pc) {
			const senders = pc.getSenders();
			const newTracks = newStream.getTracks();

			for (const sender of senders) {
				const oldTrack = sender.track;
				if (!oldTrack) continue;
				// Skip video sender if screen sharing — replacing the screen track
				// with a camera track would silently break the active screen share.
				if (oldTrack.kind === 'video' && callState.isScreenSharing) continue;
				const replacement = newTracks.find(
					(t) => t.kind === oldTrack.kind
				);
				if (replacement) {
					await sender.replaceTrack(replacement);
					logWebRTCEvent(
						'Media',
						`Replaced ${oldTrack.kind} track on peer connection`
					);
				}
			}
		}

		logWebRTCEvent('Media', 'Local stream recovered successfully');
	} catch (err) {
		logWebRTCEvent('Error', `Failed to recover local stream: ${(err as Error).message}`);
	}
}

/**
 * Sets up a visibilitychange listener to handle tab focus changes during calls.
 * When the tab becomes visible during an active call, verifies WebSocket and
 * media stream health, triggering recovery as needed.
 * @returns Cleanup function to remove the listener
 */
function setupVisibilityHandler(): () => void {
	const handler = () => {
		if (document.visibilityState === 'hidden') {
			if (callState.status !== 'idle' && callState.status !== 'ended') {
				wasHiddenDuringCall = true;
				logWebRTCEvent('Visibility', 'Tab hidden during active call');
			}
			return;
		}

		// Tab became visible
		if (!wasHiddenDuringCall) return;
		wasHiddenDuringCall = false;

		logWebRTCEvent('Visibility', 'Tab visible — checking connection health');

		// If WebSocket disconnected while hidden, reconnect immediately (bypass backoff)
		if (websocket.getConnectionState() !== 'connected') {
			logWebRTCEvent('Visibility', 'WebSocket disconnected — forcing immediate reconnect');
			websocket.immediateReconnect();
		}

		// If local media tracks went dead, attempt recovery
		if (callState.status === 'connected') {
			recoverLocalStream().catch((err) => {
				logWebRTCEvent('Error', `Unhandled stream recovery error: ${(err as Error).message}`);
			});
		}
	};

	document.addEventListener('visibilitychange', handler);
	return () => document.removeEventListener('visibilitychange', handler);
}

// Derived state getters

/**
 * Returns true if call is active (connecting or connected).
 */
export function isCallActive(): boolean {
	return callState.status === 'connecting' || callState.status === 'connected';
}

/**
 * Returns true if call can be ended (not idle or already ended).
 */
export function canEndCall(): boolean {
	return callState.status !== 'idle' && callState.status !== 'ended';
}

/**
 * Returns duration formatted as MM:SS.
 */
export function formattedDuration(): string {
	const minutes = Math.floor(callState.duration / 60);
	const seconds = callState.duration % 60;
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
