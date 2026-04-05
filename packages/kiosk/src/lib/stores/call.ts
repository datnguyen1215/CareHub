/**
 * Call state store for managing video call lifecycle.
 * Uses hierarchical state machine for call lifecycle management.
 * Kiosk acts as callee (receives calls from portal).
 */

import type {
	CallParticipant,
	CallEndReason,
	CallIncomingMessage,
	CallOfferMessage,
	IceCandidateMessage,
	CallEndedMessage,
	IceCandidate
} from '@carehub/shared';
import { getUserFriendlyError, getTopLevelState, createDurationTimer } from '@carehub/shared';
import {
	createMachine,
	createCalleeMachineConfig,
	sharedAssignActions,
	calleeAssignActions,
	CALL_EVENTS,
	logWebRTCEvent,
	type CallContext
} from '@carehub/shared/webrtc/call-state-machine';
import {
	setCallHandlers,
	sendCallAccepted,
	sendCallDeclined,
	sendCallAnswer,
	sendIceCandidate,
	sendCallEnded
} from '$lib/services/websocket';
import * as webrtc from '$lib/services/webrtc';
import { notification } from '$lib/stores/notifications';

/** Call status values */
export type CallStatus = 'idle' | 'incoming' | 'connecting' | 'connected' | 'ended';

/** Call state structure */
export interface CallState {
	status: CallStatus;
	callId: string | null;
	caller: CallParticipant | null;
	profileId: string | null;
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
	connectedAt: Date | null;
	duration: number;
	error: string | null;
	endReason: CallEndReason | null;
}

/** Initial call state */
const initialState: CallState = {
	status: 'idle',
	callId: null,
	caller: null,
	profileId: null,
	localStream: null,
	remoteStream: null,
	connectedAt: null,
	duration: 0,
	error: null,
	endReason: null
};

/** Reactive call state - only initialized on client */
let callState: CallState = { ...initialState };

/**
 * MediaStream storage - kept outside state machine context because
 * hsmjs serializes context and converts MediaStream to empty objects.
 */
let storedLocalStream: MediaStream | null = null;
let storedRemoteStream: MediaStream | null = null;

/** Duration timer from shared package */
const durationTimer = createDurationTimer((seconds) => {
	if (callState.status === 'connected') {
		callState.duration = seconds;
		notify();
	}
});

/** State machine instance */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let machine: any = null;

/** Track the previous status to detect state changes */
let previousStatus: CallStatus | null = null;

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

/**
 * Get current call state.
 * @returns Current call state
 */
export function getCallState(): CallState {
	return callState;
}

/**
 * Maps state machine state to UI status.
 */
function mapMachineStateToStatus(machineState: string): CallStatus {
	// Handle hierarchical states (e.g., "signaling.incoming")
	const topLevelState = getTopLevelState(machineState);
	const subState = machineState.split('.')[1];

	switch (topLevelState) {
		case 'idle':
			return 'idle';
		case 'signaling':
			// incoming sub-state shows incoming UI, others show connecting
			return subState === 'incoming' ? 'incoming' : 'connecting';
		case 'connecting':
			return 'connecting';
		case 'connected':
			return 'connected';
		case 'ending':
		case 'failed':
			return 'ended';
		default:
			return 'idle';
	}
}

/**
 * Syncs machine context to callState.
 * Also emits toast notifications on error states.
 */
function syncStateFromMachine(state: string, context: CallContext): void {
	const newStatus = mapMachineStateToStatus(state);

	callState.status = newStatus;
	callState.callId = context.callId;
	callState.caller = context.caller;
	callState.profileId = context.profileId;
	// Use stored streams instead of context (hsmjs serializes MediaStream to {})
	callState.localStream = storedLocalStream;
	callState.remoteStream = storedRemoteStream;
	callState.connectedAt = context.startedAt;
	callState.duration = context.duration;
	callState.error = context.error;
	callState.endReason = context.endReason;

	// Emit toast on transition to failed state (only once)
	// The 'failed' state machine state maps to 'ended' status
	if (state === 'failed' && previousStatus !== 'ended') {
		const userMessage = getUserFriendlyError(context.error);
		notification.error(userMessage);
	}

	previousStatus = newStatus;

	// Notify subscribers for cross-module reactivity
	notify();
}

/**
 * Start duration timer.
 * Increments duration every second while connected.
 */
function startDurationTimer(): void {
	durationTimer.start(new Date());
}

/**
 * Stop duration timer.
 */
function stopDurationTimer(): void {
	durationTimer.stop();
}

/**
 * Creates and initializes the call state machine with Kiosk-specific actions.
 */
function createCallMachine() {
	const config = createCalleeMachineConfig();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const actions: Record<string, any> = {
		// Shared assign actions
		...sharedAssignActions,
		...calleeAssignActions,

		// Logging actions
		logTransition: ({ event }: { event: { type: string } }) => {
			const currentState = machine?.state || 'unknown';
			logWebRTCEvent('Transition', `${currentState} (${event.type})`);
		},
		logEnterIdle: () => logWebRTCEvent('State', 'idle'),
		logEnterIncoming: () => logWebRTCEvent('State', 'signaling.incoming'),
		logEnterWaitingForOffer: () => logWebRTCEvent('State', 'signaling.waitingForOffer'),
		logEnterCreatingAnswer: () => logWebRTCEvent('State', 'signaling.creatingAnswer'),
		logEnterConnecting: () => logWebRTCEvent('State', 'connecting'),
		logEnterConnected: () => logWebRTCEvent('State', 'connected'),
		logEnterEnding: () => logWebRTCEvent('State', 'ending'),
		logEnterFailed: () => logWebRTCEvent('State', 'failed'),

		// Media actions
		acquireLocalMedia: async () => {
			try {
				logWebRTCEvent('Action', 'Acquiring local media');
				const stream = await webrtc.getLocalStream();
				// Store stream outside machine context (hsmjs serializes MediaStream to {})
				storedLocalStream = stream;
				machine.send(CALL_EVENTS.LOCAL_STREAM_READY, { stream });
			} catch (err) {
				const error = err as Error;
				console.error('Failed to get local media:', error);
				machine.send(CALL_EVENTS.MEDIA_ERROR, { error: error.message });
			}
		},

		// Peer connection actions
		createPeerConnection: () => {
			logWebRTCEvent('Action', 'Creating peer connection');
			webrtc.createPeerConnection();

			// Set up ICE candidate handler
			webrtc.onIceCandidate((candidate) => {
				logWebRTCEvent('ICE', 'Local ICE candidate gathered');
				machine.send(CALL_EVENTS.ICE_CANDIDATE, { candidate });
			});

			// Set up remote track handler
			webrtc.onTrack((stream) => {
				logWebRTCEvent('Track', 'Remote stream received');
				// Store stream outside machine context (hsmjs serializes MediaStream to {})
				storedRemoteStream = stream;
				machine.send(CALL_EVENTS.REMOTE_STREAM_READY, { stream });
			});

			// Monitor connection state
			webrtc.onConnectionStateChange((state) => {
				logWebRTCEvent('ICE', `Connection state: ${state}`);

				if (state === 'connected') {
					machine.send(CALL_EVENTS.ICE_CONNECTED);
				} else if (state === 'failed') {
					machine.send(CALL_EVENTS.ICE_FAILED);
				} else if (state === 'disconnected') {
					machine.send(CALL_EVENTS.ICE_DISCONNECTED);
				}
			});
		},

		// Signaling actions
		sendCallAccepted: ({ context }: { context: CallContext }) => {
			if (context.callId) {
				logWebRTCEvent('Signaling', 'Sending call:accepted');
				sendCallAccepted(context.callId);
			}
		},

		sendCallDeclined: ({ context }: { context: CallContext }) => {
			if (context.callId) {
				logWebRTCEvent('Signaling', 'Sending call:declined');
				sendCallDeclined(context.callId);
			}
		},

		// SDP actions
		handleOffer: async ({ event }: { event: { sdp: string } }) => {
			try {
				logWebRTCEvent('SDP', 'Handling offer');
				await webrtc.handleOffer(event.sdp);
			} catch (err) {
				const error = err as Error;
				console.error('Failed to handle offer:', error);
				machine.send(CALL_EVENTS.CALL_ERROR, { error: error.message });
			}
		},

		createAndSendAnswer: async ({ context }: { context: CallContext }) => {
			try {
				logWebRTCEvent('SDP', 'Creating answer');
				const answerSdp = await webrtc.createAnswer();
				logWebRTCEvent('Signaling', 'Sending call:answer');
				sendCallAnswer(context.callId!, answerSdp);
				machine.send(CALL_EVENTS.ANSWER_CREATED);
			} catch (err) {
				const error = err as Error;
				console.error('Failed to create answer:', error);
				machine.send(CALL_EVENTS.CALL_ERROR, { error: error.message });
			}
		},

		// ICE actions
		sendIceCandidate: ({ event }: { event: { candidate: IceCandidate } }) => {
			const context = machine.context as CallContext;
			if (context.callId) {
				logWebRTCEvent('ICE', 'Sending ICE candidate');
				sendIceCandidate(context.callId, event.candidate);
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

		// Call end actions
		sendCallEnded: ({ context }: { context: CallContext }) => {
			if (context.callId) {
				logWebRTCEvent('Signaling', 'Sending call:ended');
				sendCallEnded(context.callId);
			}
		},

		// Cleanup actions
		cleanup: () => {
			logWebRTCEvent('Action', 'Cleaning up WebRTC resources');
			webrtc.cleanup();
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
 * Handle incoming call notification from server.
 * Routes to state machine.
 */
function handleIncomingCall(message: CallIncomingMessage): void {
	// Initialize machine if needed
	if (!machine) {
		machine = createCallMachine();
	}

	// Guard: can only receive incoming call if idle
	if (!machine.matches('idle')) {
		console.warn('[Call] Ignoring incoming call: not in idle state');
		return;
	}

	logWebRTCEvent('Signaling', `Incoming call from ${message.caller.name}`);
	machine.send(CALL_EVENTS.INCOMING_CALL, {
		callId: message.callId,
		caller: message.caller,
		profileId: message.profileId
	});
}

/**
 * Handle SDP offer from caller.
 * Routes to state machine.
 */
async function handleCallOffer(message: CallOfferMessage): Promise<void> {
	if (!machine) return;

	// Ignore messages for other calls
	if (callState.callId !== message.callId) {
		console.warn('[Call] Ignoring offer for different call');
		return;
	}

	logWebRTCEvent('Signaling', 'Received call:offer');
	machine.send(CALL_EVENTS.OFFER_RECEIVED, { sdp: message.sdp });
}

/**
 * Handle ICE candidate from caller.
 * Routes to state machine.
 */
async function handleIceCandidate(message: IceCandidateMessage): Promise<void> {
	if (!machine) return;

	// Ignore messages for other calls
	if (callState.callId !== message.callId) {
		return;
	}

	logWebRTCEvent('Signaling', 'Received call:ice-candidate');
	machine.send(CALL_EVENTS.ICE_CANDIDATE, { candidate: message.candidate });
}

/**
 * Handle call ended by caller.
 * Routes to state machine.
 */
function handleCallEnded(message: CallEndedMessage): void {
	if (!machine) return;

	// Ignore messages for other calls
	if (callState.callId !== message.callId) {
		return;
	}

	logWebRTCEvent('Signaling', `Received call:ended (reason: ${message.reason})`);
	machine.send(CALL_EVENTS.CALL_ENDED, { reason: message.reason });
}

/**
 * Accept incoming call.
 * Notifies server and starts media acquisition.
 */
export async function acceptCall(): Promise<void> {
	if (!machine) return;

	// Guard: can only accept in incoming state
	if (!machine.matches('signaling.incoming')) {
		console.warn('[Call] Cannot accept: not in incoming state');
		return;
	}

	logWebRTCEvent('Action', 'Accepting call');
	machine.send(CALL_EVENTS.ACCEPT);
}

/**
 * Decline incoming call.
 * Notifies server and resets state.
 */
export function declineCall(): void {
	if (!machine) return;

	// Guard: can only decline in incoming state
	if (!machine.matches('signaling.incoming')) {
		console.warn('[Call] Cannot decline: not in incoming state');
		return;
	}

	logWebRTCEvent('Action', 'Declining call');
	machine.send(CALL_EVENTS.DECLINE);
}

/**
 * End active call.
 * Notifies server and cleans up resources.
 */
export function endCall(): void {
	if (!machine) return;

	// Guard: can only end if not already idle or ending
	if (machine.matches('idle') || machine.matches('ending')) {
		console.warn('[Call] Cannot end: already idle or ending');
		return;
	}

	logWebRTCEvent('Action', 'Ending call');
	machine.send(CALL_EVENTS.END);
}

/**
 * Reset call state to idle.
 * Call this after showing "call ended" UI.
 */
export function resetCallState(): void {
	stopDurationTimer();
	storedLocalStream = null;
	storedRemoteStream = null;
	callState = { ...initialState };
	machine = createCallMachine();
	notify();
}

/**
 * Initialize call state store.
 * Registers WebSocket message handlers.
 */
export function initCallStore(): void {
	// Initialize state machine
	machine = createCallMachine();

	setCallHandlers({
		onIncomingCall: handleIncomingCall,
		onCallOffer: handleCallOffer,
		onIceCandidate: handleIceCandidate,
		onCallEnded: handleCallEnded,
		onCallError: (message) => {
			logWebRTCEvent('Error', message.error);
			if (machine) {
				machine.send(CALL_EVENTS.CALL_ERROR, { error: message.error });
			}
		}
	});
}

/**
 * Format duration as MM:SS.
 * @param seconds - Duration in seconds
 * @returns Formatted duration
 */
export function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}
