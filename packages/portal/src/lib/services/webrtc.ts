/**
 * WebRTC peer connection manager for video calling.
 * Handles media streams, ICE candidates, and SDP negotiation.
 * Portal acts as caller (initiates calls to kiosk devices).
 */

import type { IceCandidate } from '@carehub/shared';
import {
	ICE_SERVERS,
	ICE_GATHERING_TIMEOUT_MS,
	DEFAULT_MEDIA_CONSTRAINTS,
	acquireLocalStream,
	cleanupStream,
	cleanupPeerConnection,
	type IceCandidateHandler,
	type TrackHandler,
	type ConnectionStateHandler,
	type ErrorHandler
} from '@carehub/shared';

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;

const iceCandidateHandlers = new Set<IceCandidateHandler>();
const trackHandlers = new Set<TrackHandler>();
const connectionStateHandlers = new Set<ConnectionStateHandler>();
const errorHandlers = new Set<ErrorHandler>();

/**
 * Creates and configures an RTCPeerConnection.
 * Attaches local stream tracks if available.
 */
export function createPeerConnection(): RTCPeerConnection {
	if (peerConnection) {
		closePeerConnection();
	}

	peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

	// Add local tracks to peer connection
	if (localStream) {
		localStream.getTracks().forEach((track) => {
			peerConnection!.addTrack(track, localStream!);
		});
	}

	// Handle ICE candidates
	peerConnection.onicecandidate = (event) => {
		if (event.candidate) {
			const candidate: IceCandidate = {
				candidate: event.candidate.candidate,
				sdpMid: event.candidate.sdpMid,
				sdpMLineIndex: event.candidate.sdpMLineIndex
			};
			iceCandidateHandlers.forEach((handler) => handler(candidate));
		}
	};

	// Handle remote tracks
	peerConnection.ontrack = (event) => {
		if (event.streams[0]) {
			trackHandlers.forEach((handler) => handler(event.streams[0]));
		}
	};

	// Monitor connection state
	peerConnection.oniceconnectionstatechange = () => {
		if (!peerConnection) return;

		const state = peerConnection.iceConnectionState;
		connectionStateHandlers.forEach((handler) => handler(state));

		// Handle ICE failure
		if (state === 'failed') {
			errorHandlers.forEach((handler) => handler('ICE connection failed'));
		}
	};

	return peerConnection;
}

/**
 * Closes peer connection and cleans up resources.
 */
export function closePeerConnection(): void {
	cleanupPeerConnection(peerConnection);
	peerConnection = null;
}

/**
 * Returns current ICE connection state.
 */
export function getPeerConnectionState(): RTCIceConnectionState | null {
	return peerConnection?.iceConnectionState ?? null;
}

/**
 * Requests local camera and microphone access.
 * @returns MediaStream from user's camera/mic
 * @throws Error if permission denied or media unavailable
 */
export async function getLocalStream(): Promise<MediaStream> {
	if (localStream) {
		return localStream;
	}

	try {
		localStream = await acquireLocalStream(DEFAULT_MEDIA_CONSTRAINTS);
		return localStream;
	} catch (err) {
		const error = err as Error;
		let message = 'Failed to access camera/microphone';

		if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
			message = 'Camera and microphone permission denied. Please allow access to make video calls.';
		} else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
			message = 'No camera or microphone found on this device.';
		} else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
			message = 'Camera or microphone is already in use by another application.';
		}

		errorHandlers.forEach((handler) => handler(message));
		throw new Error(message);
	}
}

/**
 * Stops all local media tracks and releases camera/microphone.
 */
export function stopLocalStream(): void {
	cleanupStream(localStream);
	localStream = null;
}

/**
 * Attaches a remote stream to a video element.
 * @param videoElement - HTML video element to display stream
 * @param stream - Remote MediaStream to display
 */
export function attachRemoteStream(videoElement: HTMLVideoElement, stream: MediaStream): void {
	videoElement.srcObject = stream;
}

/**
 * Creates an SDP offer for outgoing call.
 * Includes ICE gathering timeout.
 * @returns SDP offer string
 */
export async function createOffer(): Promise<string> {
	if (!peerConnection) {
		throw new Error('Peer connection not initialized');
	}

	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);

	// Wait for ICE gathering to complete or timeout
	await waitForIceGathering();

	return peerConnection.localDescription?.sdp ?? '';
}

/**
 * Handles incoming SDP answer from callee.
 * @param sdp - SDP answer string
 */
export async function handleAnswer(sdp: string): Promise<void> {
	if (!peerConnection) {
		throw new Error('Peer connection not initialized');
	}

	const answer = new RTCSessionDescription({
		type: 'answer',
		sdp
	});

	await peerConnection.setRemoteDescription(answer);
}

/**
 * Adds a received ICE candidate to the peer connection.
 * @param candidate - ICE candidate from remote peer
 */
export async function addIceCandidate(candidate: IceCandidate): Promise<void> {
	if (!peerConnection) {
		console.warn('[WebRTC] Cannot add ICE candidate, no peer connection');
		return;
	}

	try {
		const rtcCandidate = new RTCIceCandidate({
			candidate: candidate.candidate,
			sdpMid: candidate.sdpMid,
			sdpMLineIndex: candidate.sdpMLineIndex
		});
		await peerConnection.addIceCandidate(rtcCandidate);
	} catch (err) {
		console.error('[WebRTC] Failed to add ICE candidate:', err);
	}
}

/**
 * Subscribes to outgoing ICE candidates.
 * @param handler - Function called with each ICE candidate
 * @returns Unsubscribe function
 */
export function onIceCandidate(handler: IceCandidateHandler): () => void {
	iceCandidateHandlers.add(handler);
	return () => {
		iceCandidateHandlers.delete(handler);
	};
}

/**
 * Subscribes to remote track arrival events.
 * @param handler - Function called when remote stream is received
 * @returns Unsubscribe function
 */
export function onTrack(handler: TrackHandler): () => void {
	trackHandlers.add(handler);
	return () => {
		trackHandlers.delete(handler);
	};
}

/**
 * Subscribes to ICE connection state changes.
 * @param handler - Function called on state change
 * @returns Unsubscribe function
 */
export function onConnectionStateChange(handler: ConnectionStateHandler): () => void {
	connectionStateHandlers.add(handler);
	return () => {
		connectionStateHandlers.delete(handler);
	};
}

/**
 * Subscribes to WebRTC errors.
 * @param handler - Function called with error message
 * @returns Unsubscribe function
 */
export function onError(handler: ErrorHandler): () => void {
	errorHandlers.add(handler);
	return () => {
		errorHandlers.delete(handler);
	};
}

/**
 * Waits for ICE gathering to complete or timeout.
 */
async function waitForIceGathering(): Promise<void> {
	if (!peerConnection) return;

	// If already complete, return immediately
	if (peerConnection.iceGatheringState === 'complete') {
		return;
	}

	const pc = peerConnection;

	return new Promise<void>((resolve) => {
		const checkState = () => {
			if (pc.iceGatheringState === 'complete') {
				clearTimeout(timeoutId);
				pc.removeEventListener('icegatheringstatechange', checkState);
				resolve();
			}
		};

		const timeoutId = setTimeout(() => {
			pc.removeEventListener('icegatheringstatechange', checkState);
			resolve();
		}, ICE_GATHERING_TIMEOUT_MS);

		pc.addEventListener('icegatheringstatechange', checkState);
	});
}

/**
 * Toggles local audio track enabled state.
 * @param enabled - Whether audio should be enabled
 */
export function setAudioEnabled(enabled: boolean): void {
	if (localStream) {
		localStream.getAudioTracks().forEach((track) => {
			track.enabled = enabled;
		});
	}
}

/**
 * Toggles local video track enabled state.
 * @param enabled - Whether video should be enabled
 */
export function setVideoEnabled(enabled: boolean): void {
	if (localStream) {
		localStream.getVideoTracks().forEach((track) => {
			track.enabled = enabled;
		});
	}
}

/**
 * Returns the current local stream if available.
 */
export function getCurrentLocalStream(): MediaStream | null {
	return localStream;
}
