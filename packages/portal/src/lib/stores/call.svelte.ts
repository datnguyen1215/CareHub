/**
 * Svelte 5 runes-based call state store for WebRTC video calling.
 * Uses hierarchical state machine for call lifecycle management.
 * Portal acts as caller (initiates calls to kiosk devices).
 */

import type { SignalingMessage, CallEndReason, IceCandidate } from '@carehub/shared';
import {
	createMachine,
	createCallerMachineConfig,
	sharedAssignActions,
	callerAssignActions,
	CALL_EVENTS,
	logTransition,
	logWebRTCEvent,
	type CallContext
} from '@carehub/shared/webrtc/call-state-machine';
import * as websocket from '$lib/services/websocket';
import * as webrtc from '$lib/services/webrtc';
import { toast } from '$lib/stores/toast';

/** Maps technical errors to user-friendly messages */
function getUserFriendlyError(error: string | null): string {
	if (!error) return 'Call failed. Please try again.';

	const errorLower = error.toLowerCase();

	// WebSocket/connection issues
	if (errorLower.includes('websocket') || errorLower.includes('unable to connect')) {
		return 'Connection lost. Please check your internet and try again.';
	}

	// Device status issues
	if (errorLower.includes('offline') || errorLower.includes('not connected')) {
		return 'Device is offline. Please check the tablet.';
	}

	// Call declined
	if (errorLower.includes('declined')) {
		return 'Call was declined.';
	}

	// ICE/network issues
	if (errorLower.includes('ice') || errorLower.includes('network')) {
		return 'Could not establish video connection. Check your network.';
	}

	// Timeout
	if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
		return 'Call timed out. Please try again.';
	}

	// Media permissions
	if (
		errorLower.includes('permission') ||
		errorLower.includes('notallowed') ||
		errorLower.includes('not allowed')
	) {
		return 'Camera/microphone access denied. Please allow permissions.';
	}

	// Media device issues
	if (errorLower.includes('notfound') || errorLower.includes('not found')) {
		return 'Camera or microphone not found. Please check your devices.';
	}

	// Return original error if already user-friendly or unrecognized
	return error;
}

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
	isVideoOff: false
};

/** Reactive call state using Svelte 5 runes */
export const callState = $state<CallState>({ ...initialState });

/**
 * MediaStream storage - kept outside state machine context because
 * hsmjs serializes context and converts MediaStream to empty objects.
 */
let storedLocalStream: MediaStream | null = null;
let storedRemoteStream: MediaStream | null = null;

/** Subscription listeners for cross-module reactivity */
type CallStateListener = (state: CallState) => void;
const listeners = new Set<CallStateListener>();

/**
 * Notifies all subscribers with a shallow copy of current state.
 * Shallow copy ensures new object reference triggers Svelte reactivity.
 */
function notify(): void {
	const snapshot = { ...callState };
	listeners.forEach((listener) => listener(snapshot));
}

/**
 * Subscribe to call state changes.
 * @param listener - Callback invoked when state changes
 * @returns Unsubscribe function
 */
export function subscribe(listener: CallStateListener): () => void {
	listeners.add(listener);
	// Immediately call with current state
	listener({ ...callState });
	return () => {
		listeners.delete(listener);
	};
}

/** Duration timer interval ID */
let durationIntervalId: ReturnType<typeof setInterval> | null = null;

/** State machine instance */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let machine: any = null;

/**
 * Maps state machine state to UI status.
 */
function mapMachineStateToStatus(machineState: string): CallStatusType {
	// Handle hierarchical states (e.g., "signaling.waitingForAccept")
	const topLevelState = machineState.split('.')[0];

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

	// Notify subscribers for cross-module reactivity
	notify();
}

/**
 * Updates the duration counter every second when connected.
 */
function startDurationTimer(): void {
	if (durationIntervalId) return;

	durationIntervalId = setInterval(() => {
		if (callState.status === 'connected' && callState.startedAt) {
			callState.duration = Math.floor((Date.now() - callState.startedAt.getTime()) / 1000);
			notify();
		}
	}, 1000);
}

/**
 * Stops the duration counter.
 */
function stopDurationTimer(): void {
	if (durationIntervalId) {
		clearInterval(durationIntervalId);
		durationIntervalId = null;
	}
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

		// Logging actions
		logTransition: ({ context, event }: { context: CallContext; event: { type: string } }) => {
			const currentState = machine?.state || 'unknown';
			logTransition(currentState, currentState, event.type);
		},
		logEnterIdle: () => logWebRTCEvent('State', 'idle'),
		logEnterInitiating: () => logWebRTCEvent('State', 'initiating'),
		logEnterWaitingForAccept: () => logWebRTCEvent('State', 'signaling.waitingForAccept'),
		logEnterCreatingOffer: () => logWebRTCEvent('State', 'signaling.creatingOffer'),
		logEnterExchangingIce: () => logWebRTCEvent('State', 'signaling.exchangingIce'),
		logEnterConnecting: () => logWebRTCEvent('State', 'connecting'),
		logEnterConnected: () => logWebRTCEvent('State', 'connected'),
		logEnterEnding: () => logWebRTCEvent('State', 'ending'),
		logEnterFailed: () => logWebRTCEvent('State', 'failed'),

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
			logWebRTCEvent('Signaling', `Sending call:initiate to ${context.targetDeviceId}`);
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
				logWebRTCEvent('ICE', 'Flushing pending ICE candidate');
				await webrtc.addIceCandidate(candidate);
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

		// Call end actions
		sendCallEnded: ({ context }: { context: CallContext }) => {
			if (context.callId) {
				logWebRTCEvent('Signaling', 'Sending call:ended');
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
			webrtc.stopLocalStream();
			webrtc.closePeerConnection();
			// Clear stored streams
			storedLocalStream = null;
			storedRemoteStream = null;
			// Trigger cleanup complete after cleanup
			setTimeout(() => {
				machine?.send(CALL_EVENTS.CLEANUP_COMPLETE);
			}, 0);
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
		console.warn('[Call] Cannot initiate: not in idle state');
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
		console.warn('[Call] Cannot end: already idle or ending');
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
	notify();
}

/**
 * Toggles local video on/off.
 */
export function toggleVideo(): void {
	callState.isVideoOff = !callState.isVideoOff;
	webrtc.setVideoEnabled(!callState.isVideoOff);
	logWebRTCEvent('Media', `Video ${callState.isVideoOff ? 'off' : 'on'}`);
	notify();
}

/**
 * Handles incoming signaling messages from WebSocket.
 * Routes messages to state machine events.
 * @param message - Signaling message from WebSocket
 */
export async function handleIncomingSignal(message: SignalingMessage): Promise<void> {
	console.log(
		'[Call] handleIncomingSignal:',
		message.type,
		'machine:',
		!!machine,
		'sessionId:',
		callState.sessionId
	);
	if (!machine) return;

	// Ignore messages for other calls (except call:ringing which establishes the session)
	if (
		'callId' in message &&
		message.type !== 'call:ringing' &&
		message.callId !== callState.sessionId
	) {
		console.log(
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
			logWebRTCEvent('Signaling', `Call ringing, sessionId updated to ${message.callId}`);
			break;

		case 'call:accepted':
			machine.send(CALL_EVENTS.CALL_ACCEPTED);
			break;

		case 'call:declined':
			machine.send(CALL_EVENTS.CALL_DECLINED);
			break;

		case 'call:ended':
			machine.send(CALL_EVENTS.CALL_ENDED, { reason: message.reason });
			break;

		case 'call:answer':
			machine.send(CALL_EVENTS.ANSWER_RECEIVED, { sdp: message.sdp });
			break;

		case 'call:ice-candidate':
			machine.send(CALL_EVENTS.ICE_CANDIDATE, { candidate: message.candidate });
			break;

		case 'call:error':
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

	// Return cleanup function
	return () => {
		unsubTrack();
		unsubState();
		unsubIce();
		unsubError();
		unsubMessage();
		unsubDisconnect();
		stopDurationTimer();
	};
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
