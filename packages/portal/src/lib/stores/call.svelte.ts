/**
 * Svelte 5 runes-based call state store for WebRTC video calling.
 * Manages call lifecycle, media streams, and UI state.
 */

import type { SignalingMessage, CallEndReason } from '@carehub/shared';
import * as websocket from '$lib/services/websocket';
import * as webrtc from '$lib/services/webrtc';

/** Call status representing the call lifecycle */
export type CallStatusType =
	| 'idle'
	| 'initiating'
	| 'ringing'
	| 'connecting'
	| 'connected'
	| 'ended'
	| 'failed';

/** Call state structure */
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

/** Duration timer interval ID */
let durationIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Updates the duration counter every second when connected.
 */
function startDurationTimer(): void {
	if (durationIntervalId) return;

	durationIntervalId = setInterval(() => {
		if (callState.status === 'connected' && callState.startedAt) {
			callState.duration = Math.floor((Date.now() - callState.startedAt.getTime()) / 1000);
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
 * Resets call state to initial values.
 */
function resetState(): void {
	stopDurationTimer();
	Object.assign(callState, { ...initialState });
}

/**
 * Initiates a call to a device.
 * Gets local media stream and sends call:initiate message.
 * @param deviceId - Target device ID
 * @param deviceName - Target device name for display
 */
export async function initiateCall(deviceId: string, deviceName: string): Promise<void> {
	try {
		// Reset any previous call state
		resetState();

		callState.status = 'initiating';
		callState.targetDeviceId = deviceId;
		callState.targetDeviceName = deviceName;

		// Get local media stream
		const stream = await webrtc.getLocalStream();
		callState.localStream = stream;

		// Create peer connection with local stream
		webrtc.createPeerConnection();

		// Generate call ID
		const callId = crypto.randomUUID();
		callState.sessionId = callId;

		// Send call initiation
		const sent = websocket.send({
			type: 'call:initiate',
			callId,
			deviceId,
			profileId: null
		});

		if (!sent) {
			// WebSocket not connected - clean up and fail
			webrtc.stopLocalStream();
			webrtc.closePeerConnection();
			callState.status = 'failed';
			callState.error = 'Unable to connect. Please check your internet connection and try again.';
			return;
		}

		callState.status = 'ringing';
	} catch (err) {
		const error = err as Error;
		callState.status = 'failed';
		callState.error = error.message;
	}
}

/**
 * Ends the current call.
 * Sends call:ended message and cleans up resources.
 */
export function endCall(reason: CallEndReason = 'completed'): void {
	if (callState.sessionId) {
		websocket.send({
			type: 'call:ended',
			callId: callState.sessionId,
			reason
		});
	}

	// Clean up WebRTC
	webrtc.stopLocalStream();
	webrtc.closePeerConnection();

	// Reset state
	resetState();
}

/**
 * Toggles local audio mute state.
 */
export function toggleMute(): void {
	callState.isMuted = !callState.isMuted;
	webrtc.setAudioEnabled(!callState.isMuted);
}

/**
 * Toggles local video on/off.
 */
export function toggleVideo(): void {
	callState.isVideoOff = !callState.isVideoOff;
	webrtc.setVideoEnabled(!callState.isVideoOff);
}

/**
 * Handles incoming signaling messages from WebSocket.
 * Routes messages to appropriate handlers based on type.
 * @param message - Signaling message from WebSocket
 */
export async function handleIncomingSignal(message: SignalingMessage): Promise<void> {
	// Ignore messages for other calls
	if ('callId' in message && message.callId !== callState.sessionId) {
		return;
	}

	switch (message.type) {
		case 'call:accepted':
			await handleCallAccepted();
			break;

		case 'call:declined':
			handleCallDeclined();
			break;

		case 'call:ended':
			handleCallEnded(message.reason);
			break;

		case 'call:answer':
			await handleAnswer(message.sdp);
			break;

		case 'call:ice-candidate':
			await webrtc.addIceCandidate(message.candidate);
			break;

		case 'call:error':
			handleCallError(message.error);
			break;
	}
}

/**
 * Handles call accepted by device - creates and sends SDP offer.
 */
async function handleCallAccepted(): Promise<void> {
	try {
		callState.status = 'connecting';

		// Create and send offer
		const sdp = await webrtc.createOffer();

		if (callState.sessionId) {
			websocket.send({
				type: 'call:offer',
				callId: callState.sessionId,
				sdp
			});
		}
	} catch (err) {
		const error = err as Error;
		callState.status = 'failed';
		callState.error = error.message;
	}
}

/**
 * Handles call declined by device.
 */
function handleCallDeclined(): void {
	webrtc.stopLocalStream();
	webrtc.closePeerConnection();

	callState.status = 'ended';
	callState.error = 'Call was declined';
}

/**
 * Handles call ended by remote party.
 */
function handleCallEnded(_reason: CallEndReason): void {
	webrtc.stopLocalStream();
	webrtc.closePeerConnection();

	resetState();
}

/**
 * Handles SDP answer from callee.
 */
async function handleAnswer(sdp: string): Promise<void> {
	try {
		await webrtc.handleAnswer(sdp);
		callState.status = 'connected';
		callState.startedAt = new Date();
		startDurationTimer();
	} catch (err) {
		const error = err as Error;
		callState.status = 'failed';
		callState.error = error.message;
	}
}

/**
 * Handles call error from backend.
 */
function handleCallError(error: string): void {
	webrtc.stopLocalStream();
	webrtc.closePeerConnection();

	callState.status = 'failed';
	callState.error = error;
}

/**
 * Sets up WebRTC event handlers.
 * Should be called once when the module loads.
 */
export function initializeCallHandlers(): () => void {
	// Handle remote track arrival
	const unsubTrack = webrtc.onTrack((stream) => {
		callState.remoteStream = stream;
	});

	// Handle ICE connection state changes
	const unsubState = webrtc.onConnectionStateChange((state) => {
		if (state === 'connected') {
			if (callState.status !== 'connected') {
				callState.status = 'connected';
				callState.startedAt = new Date();
				startDurationTimer();
			}
		} else if (state === 'disconnected' || state === 'failed') {
			if (callState.status === 'connected') {
				callState.status = 'failed';
				callState.error = 'Connection lost';
				stopDurationTimer();
			}
		}
	});

	// Handle ICE candidates - send to remote
	const unsubIce = webrtc.onIceCandidate((candidate) => {
		if (callState.sessionId) {
			websocket.send({
				type: 'call:ice-candidate',
				callId: callState.sessionId,
				candidate
			});
		}
	});

	// Handle WebRTC errors
	const unsubError = webrtc.onError((error) => {
		callState.error = error;
		if (callState.status === 'initiating' || callState.status === 'ringing') {
			callState.status = 'failed';
		}
	});

	// Handle WebSocket messages
	const unsubMessage = websocket.onMessage((message) => {
		handleIncomingSignal(message);
	});

	// Return cleanup function
	return () => {
		unsubTrack();
		unsubState();
		unsubIce();
		unsubError();
		unsubMessage();
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
