/**
 * User-friendly error message mapping for WebRTC calls.
 * Shared between Portal (caller) and Kiosk (callee).
 */

/**
 * Maps technical WebRTC/WebSocket errors to user-friendly messages.
 * @param error - Raw error string or null
 * @returns User-friendly error message
 */
export function getUserFriendlyError(error: string | null): string {
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
