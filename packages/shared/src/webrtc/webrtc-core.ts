/**
 * Core WebRTC utilities shared between Portal (caller) and Kiosk (callee).
 * Provides peer connection factory, stream management, and media constraints.
 */

import { ICE_SERVERS } from './constants.js'
import type { IceCandidate } from './types.js'

/** Default media constraints for video calling */
export const DEFAULT_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
	video: {
		width: { ideal: 1280 },
		height: { ideal: 720 },
		facingMode: 'user'
	},
	audio: {
		echoCancellation: true,
		noiseSuppression: true
	}
}

/** Handler types for peer connection events */
export type IceCandidateHandler = (candidate: IceCandidate) => void
export type TrackHandler = (stream: MediaStream) => void
export type ConnectionStateHandler = (state: RTCPeerConnectionState | RTCIceConnectionState) => void
export type ErrorHandler = (error: string) => void

/**
 * Acquires local camera and microphone stream via getUserMedia.
 * @param constraints - Media constraints (defaults to DEFAULT_MEDIA_CONSTRAINTS)
 * @returns Local MediaStream
 * @throws DOMException if access denied or media unavailable
 */
export async function acquireLocalStream(
	constraints: MediaStreamConstraints = DEFAULT_MEDIA_CONSTRAINTS
): Promise<MediaStream> {
	return navigator.mediaDevices.getUserMedia(constraints)
}

/**
 * Stops all tracks on a MediaStream, releasing camera/microphone.
 * @param stream - The stream to clean up (no-op if null)
 */
export function cleanupStream(stream: MediaStream | null): void {
	if (stream) {
		stream.getTracks().forEach((track) => track.stop())
	}
}

/**
 * Closes an RTCPeerConnection safely.
 * Removes all senders and closes the connection.
 * @param pc - The peer connection to close (no-op if null)
 */
export function cleanupPeerConnection(pc: RTCPeerConnection | null): void {
	if (pc) {
		pc.getSenders().forEach((sender) => {
			pc.removeTrack(sender)
		})
		pc.close()
	}
}

export { ICE_SERVERS }
