/** Call state store for managing video call lifecycle. Uses Svelte 5 runes. */

import type {
	CallParticipant,
	CallEndReason,
	CallIncomingMessage,
	CallOfferMessage,
	IceCandidateMessage,
	CallEndedMessage
} from '@carehub/shared';
import {
	setCallHandlers,
	sendCallAccepted,
	sendCallDeclined,
	sendCallAnswer,
	sendIceCandidate,
	sendCallEnded
} from '$lib/services/websocket';
import * as webrtc from '$lib/services/webrtc';

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

/** Reactive call state using Svelte 5 runes */
let callState = $state<CallState>({ ...initialState });

/** Duration timer interval */
let durationTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get current call state.
 * @returns {CallState} Current call state
 */
export function getCallState(): CallState {
	return callState;
}

/**
 * Handle incoming call notification from server.
 * Sets status to 'incoming' and stores caller info.
 */
function handleIncomingCall(message: CallIncomingMessage): void {
	// Ignore if already in a call
	if (callState.status !== 'idle') {
		console.warn('Ignoring incoming call: already in call');
		return;
	}

	callState.status = 'incoming';
	callState.callId = message.callId;
	callState.caller = message.caller;
	callState.profileId = message.profileId;
	callState.error = null;
	callState.endReason = null;
}

/**
 * Handle SDP offer from caller.
 * Sets remote description and creates answer.
 */
async function handleCallOffer(message: CallOfferMessage): Promise<void> {
	if (callState.callId !== message.callId) {
		console.warn('Ignoring offer for different call');
		return;
	}

	// Guard against offer arriving after call ended (network reordering)
	if (callState.status !== 'connecting') {
		console.warn('Ignoring offer: call not in connecting state');
		return;
	}

	try {
		await webrtc.handleOffer(message.sdp);
		const answerSdp = await webrtc.createAnswer();
		sendCallAnswer(message.callId, answerSdp);
	} catch (err) {
		console.error('Failed to handle offer:', err);
		callState.error = 'Failed to establish connection';
		endCallInternal();
	}
}

/**
 * Handle ICE candidate from caller.
 */
async function handleIceCandidate(message: IceCandidateMessage): Promise<void> {
	if (callState.callId !== message.callId) {
		return;
	}

	// Guard against ICE candidates arriving after call ended
	if (callState.status !== 'connecting' && callState.status !== 'connected') {
		return;
	}

	await webrtc.addIceCandidate(message.candidate);
}

/**
 * Handle call ended by caller.
 */
function handleCallEnded(message: CallEndedMessage): void {
	if (callState.callId !== message.callId) {
		return;
	}

	callState.endReason = message.reason;
	callState.status = 'ended';
	cleanup();
}

/**
 * Accept incoming call.
 * Acquires local media and notifies server.
 */
export async function acceptCall(): Promise<void> {
	if (callState.status !== 'incoming' || !callState.callId) {
		console.warn('Cannot accept: no incoming call');
		return;
	}

	callState.status = 'connecting';
	callState.error = null;

	try {
		// Create peer connection first
		webrtc.createPeerConnection();

		// Set up ICE candidate handler
		webrtc.onIceCandidate((candidate) => {
			if (callState.callId) {
				sendIceCandidate(callState.callId, candidate);
			}
		});

		// Set up remote track handler
		webrtc.onTrack((stream) => {
			callState.remoteStream = stream;
		});

		// Monitor connection state
		webrtc.onConnectionStateChange((state) => {
			if (state === 'connected') {
				callState.status = 'connected';
				callState.connectedAt = new Date();
				startDurationTimer();
			} else if (state === 'failed' || state === 'disconnected') {
				callState.error = 'Connection lost';
				endCallInternal();
			}
		});

		// Get local media stream
		const stream = await webrtc.getLocalStream();

		// Check if call was ended while awaiting media permissions
		if (callState.status !== 'connecting') {
			// Call ended during await, clean up the stream
			stream.getTracks().forEach((track) => track.stop());
			return;
		}

		callState.localStream = stream;

		// Notify server we accepted
		sendCallAccepted(callState.callId);
	} catch (err) {
		const error = err as Error;
		console.error('Failed to accept call:', error);
		callState.error = error.message || 'Failed to start video';
		callState.status = 'ended';
		cleanup();
	}
}

/**
 * Decline incoming call.
 * Notifies server and resets state.
 */
export function declineCall(): void {
	if (!callState.callId) {
		return;
	}

	sendCallDeclined(callState.callId);
	callState.endReason = 'declined';
	callState.status = 'ended';
	cleanup();
}

/**
 * End active call.
 * Notifies server and cleans up resources.
 */
export function endCall(): void {
	if (!callState.callId) {
		return;
	}

	sendCallEnded(callState.callId);
	callState.endReason = 'completed';
	callState.status = 'ended';
	cleanup();
}

/**
 * End call internally without sending message.
 * Used when caller ends or on error.
 */
function endCallInternal(): void {
	callState.status = 'ended';
	cleanup();
}

/**
 * Reset call state to idle.
 * Call this after showing "call ended" UI.
 */
export function resetCallState(): void {
	stopDurationTimer();
	callState = { ...initialState };
}

/**
 * Start duration timer.
 * Increments duration every second while connected.
 */
function startDurationTimer(): void {
	stopDurationTimer();
	durationTimer = setInterval(() => {
		if (callState.status === 'connected') {
			callState.duration += 1;
		}
	}, 1000);
}

/**
 * Stop duration timer.
 */
function stopDurationTimer(): void {
	if (durationTimer) {
		clearInterval(durationTimer);
		durationTimer = null;
	}
}

/**
 * Clean up call resources.
 */
function cleanup(): void {
	stopDurationTimer();
	webrtc.cleanup();
}

/**
 * Initialize call state store.
 * Registers WebSocket message handlers.
 */
export function initCallStore(): void {
	setCallHandlers({
		onIncomingCall: handleIncomingCall,
		onCallOffer: handleCallOffer,
		onIceCandidate: handleIceCandidate,
		onCallEnded: handleCallEnded,
		onCallError: (message) => {
			console.error('Call error:', message.error);
			callState.error = message.error;
			endCallInternal();
		}
	});
}

/**
 * Format duration as MM:SS.
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}
