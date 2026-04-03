/** WebRTC manager for video call peer connections. Kiosk is always the callee. */

import type { IceCandidate } from '@carehub/shared';
import {
	ICE_SERVERS,
	DEFAULT_MEDIA_CONSTRAINTS,
	acquireLocalStream,
	cleanupStream,
	cleanupPeerConnection,
	type IceCandidateHandler,
	type TrackHandler,
	type ConnectionStateHandler
} from '@carehub/shared';

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let iceCandidateHandler: IceCandidateHandler | null = null;
let trackHandler: TrackHandler | null = null;
let connectionStateHandler: ConnectionStateHandler | null = null;

/**
 * Create and configure RTCPeerConnection.
 * Initializes connection with ICE servers and event handlers.
 * Adds local tracks if localStream is already available.
 */
export function createPeerConnection(): RTCPeerConnection {
	if (peerConnection) {
		closePeerConnection();
	}

	peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

	// Add local tracks to peer connection if already available
	if (localStream) {
		localStream.getTracks().forEach((track) => {
			peerConnection!.addTrack(track, localStream!);
		});
	}

	// Handle ICE candidates to send to caller
	peerConnection.onicecandidate = (event) => {
		if (event.candidate && iceCandidateHandler) {
			iceCandidateHandler({
				candidate: event.candidate.candidate,
				sdpMid: event.candidate.sdpMid,
				sdpMLineIndex: event.candidate.sdpMLineIndex
			});
		}
	};

	// Handle incoming tracks from caller
	peerConnection.ontrack = (event) => {
		if (event.streams[0] && trackHandler) {
			trackHandler(event.streams[0]);
		}
	};

	// Handle connection state changes
	peerConnection.onconnectionstatechange = () => {
		if (peerConnection && connectionStateHandler) {
			connectionStateHandler(peerConnection.connectionState);
		}
	};

	return peerConnection;
}

/**
 * Close and clean up peer connection.
 */
export function closePeerConnection(): void {
	if (peerConnection) {
		peerConnection.onicecandidate = null;
		peerConnection.ontrack = null;
		peerConnection.onconnectionstatechange = null;
		cleanupPeerConnection(peerConnection);
		peerConnection = null;
	}
}

/**
 * Get current peer connection state.
 * @returns {RTCPeerConnectionState | null} Current state or null if no connection
 */
export function getPeerConnectionState(): RTCPeerConnectionState | null {
	return peerConnection?.connectionState ?? null;
}

/**
 * Request access to camera and microphone.
 * @returns {Promise<MediaStream>} Local media stream
 * @throws {Error} If media access is denied or unavailable
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
		// Provide user-friendly error messages
		if (error.name === 'NotAllowedError') {
			throw new Error('Camera and microphone access was denied');
		} else if (error.name === 'NotFoundError') {
			throw new Error('No camera or microphone found');
		} else if (error.name === 'NotReadableError') {
			throw new Error('Camera or microphone is already in use');
		}
		throw new Error('Could not access camera and microphone');
	}
}

/**
 * Stop and release local media stream.
 */
export function stopLocalStream(): void {
	cleanupStream(localStream);
	localStream = null;
}

/**
 * Attach remote stream to a video element.
 * @param {HTMLVideoElement} videoElement - Video element to display remote stream
 * @param {MediaStream} stream - Remote media stream
 */
export function attachRemoteStream(videoElement: HTMLVideoElement, stream: MediaStream): void {
	videoElement.srcObject = stream;
}

/**
 * Handle SDP offer from caller.
 * Sets remote description on peer connection.
 * @param {string} sdp - SDP offer string
 */
export async function handleOffer(sdp: string): Promise<void> {
	if (!peerConnection) {
		throw new Error('Peer connection not initialized');
	}

	const offer: RTCSessionDescriptionInit = {
		type: 'offer',
		sdp
	};

	await peerConnection.setRemoteDescription(offer);
}

/**
 * Create SDP answer after receiving offer.
 * Must be called after handleOffer.
 * @returns {Promise<string>} SDP answer string
 */
export async function createAnswer(): Promise<string> {
	if (!peerConnection) {
		throw new Error('Peer connection not initialized');
	}

	const answer = await peerConnection.createAnswer();
	await peerConnection.setLocalDescription(answer);

	if (!answer.sdp) {
		throw new Error('Failed to create answer');
	}

	return answer.sdp;
}

/**
 * Add ICE candidate from caller.
 * @param {IceCandidate} candidate - ICE candidate from caller
 */
export async function addIceCandidate(candidate: IceCandidate): Promise<void> {
	if (!peerConnection) {
		console.warn('Cannot add ICE candidate: no peer connection');
		return;
	}

	try {
		await peerConnection.addIceCandidate({
			candidate: candidate.candidate,
			sdpMid: candidate.sdpMid,
			sdpMLineIndex: candidate.sdpMLineIndex
		});
	} catch (err) {
		console.error('Failed to add ICE candidate:', err);
	}
}

/**
 * Register handler for local ICE candidates.
 * @param {IceCandidateHandler} handler - Handler function
 */
export function onIceCandidate(handler: IceCandidateHandler): void {
	iceCandidateHandler = handler;
}

/**
 * Register handler for remote tracks.
 * @param {TrackHandler} handler - Handler function
 */
export function onTrack(handler: TrackHandler): void {
	trackHandler = handler;
}

/**
 * Register handler for connection state changes.
 * @param {ConnectionStateHandler} handler - Handler function
 */
export function onConnectionStateChange(handler: ConnectionStateHandler): void {
	connectionStateHandler = handler;
}

/**
 * Get the current local stream if available.
 * @returns {MediaStream | null} Local stream or null
 */
export function getCurrentLocalStream(): MediaStream | null {
	return localStream;
}

/**
 * Clean up all WebRTC resources.
 * Stops local stream and closes peer connection.
 */
export function cleanup(): void {
	stopLocalStream();
	closePeerConnection();
	iceCandidateHandler = null;
	trackHandler = null;
	connectionStateHandler = null;
}
