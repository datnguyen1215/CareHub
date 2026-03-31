/** Storage service for device token persistence. */

const DEVICE_TOKEN_KEY = 'carehub_device_token';
const DEVICE_ID_KEY = 'carehub_device_id';

/**
 * Save device credentials to storage.
 * @param {string} deviceId - Device ID
 * @param {string} deviceToken - Device token for auth
 */
export function saveDeviceCredentials(deviceId: string, deviceToken: string): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(DEVICE_ID_KEY, deviceId);
		localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
	}
}

/**
 * Get saved device credentials.
 * @returns {{ deviceId: string, deviceToken: string } | null}
 */
export function getDeviceCredentials(): { deviceId: string; deviceToken: string } | null {
	if (typeof localStorage === 'undefined') return null;

	const deviceId = localStorage.getItem(DEVICE_ID_KEY);
	const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);

	if (deviceId && deviceToken) {
		return { deviceId, deviceToken };
	}
	return null;
}

/**
 * Clear all stored device credentials.
 */
export function clearDeviceCredentials(): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(DEVICE_ID_KEY);
		localStorage.removeItem(DEVICE_TOKEN_KEY);
	}
}
