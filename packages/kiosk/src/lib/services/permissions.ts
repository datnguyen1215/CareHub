/** Permission handling for camera and microphone access. */

export type PermissionStatus = 'granted' | 'denied' | 'prompt'

/**
 * Check camera permission status.
 * @returns {Promise<PermissionStatus>} Permission status
 */
export async function checkCameraPermission(): Promise<PermissionStatus> {
	try {
		// Use Permissions API if available
		if (navigator.permissions) {
			const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
			return result.state as PermissionStatus
		}
		// Fallback: try to access camera briefly
		return await testMediaAccess({ video: true })
	} catch {
		return 'prompt'
	}
}

/**
 * Check microphone permission status.
 * @returns {Promise<PermissionStatus>} Permission status
 */
export async function checkMicrophonePermission(): Promise<PermissionStatus> {
	try {
		// Use Permissions API if available
		if (navigator.permissions) {
			const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
			return result.state as PermissionStatus
		}
		// Fallback: try to access microphone briefly
		return await testMediaAccess({ audio: true })
	} catch {
		return 'prompt'
	}
}

/**
 * Test media access by requesting and immediately stopping stream.
 */
async function testMediaAccess(constraints: MediaStreamConstraints): Promise<PermissionStatus> {
	try {
		const stream = await navigator.mediaDevices.getUserMedia(constraints)
		stream.getTracks().forEach((track) => track.stop())
		return 'granted'
	} catch (err) {
		const error = err as Error
		if (error.name === 'NotAllowedError') {
			return 'denied'
		}
		return 'prompt'
	}
}

/**
 * Request both camera and microphone permissions.
 * Triggers system permission dialogs on Android/browsers.
 * @returns {Promise<boolean>} True if both permissions granted
 */
export async function requestMediaPermissions(): Promise<boolean> {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true
		})
		// Immediately stop tracks - we just needed permission
		stream.getTracks().forEach((track) => track.stop())
		return true
	} catch {
		return false
	}
}

/**
 * Check if permissions are permanently denied.
 * On Android, this typically means user selected "Never ask again".
 * @returns {Promise<boolean>} True if permissions permanently denied
 */
export async function arePermissionsPermanentlyDenied(): Promise<boolean> {
	const camera = await checkCameraPermission()
	const microphone = await checkMicrophonePermission()
	// If either is denied (not prompt), consider it permanent
	return camera === 'denied' || microphone === 'denied'
}

/**
 * Open app settings for permission management.
 * Only works on native Android via Capacitor App plugin.
 */
export async function openAppSettings(): Promise<void> {
	// Try Capacitor App plugin if available
	try {
		const { App } = await import('@capacitor/app')
		// Capacitor doesn't have direct settings API, but we can guide user
		console.log('Capacitor App loaded, but no direct settings API')
	} catch {
		// Not on Capacitor or plugin not available
	}

	// For web, show instructions (handled by PermissionError component)
	console.log('Please go to browser/app settings to enable camera and microphone')
}
