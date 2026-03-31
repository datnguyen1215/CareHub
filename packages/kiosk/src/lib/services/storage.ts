/**
 * Storage service for device token persistence.
 * Uses Capacitor Preferences on native, localStorage in browser.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const DEVICE_TOKEN_KEY = 'carehub_device_token';
const DEVICE_ID_KEY = 'carehub_device_id';

/** Check if running on native platform. */
const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Save device credentials to storage.
 * Uses Capacitor Preferences on native, localStorage in browser.
 */
export async function saveDeviceCredentials(deviceId: string, deviceToken: string): Promise<void> {
	if (isNative()) {
		await Preferences.set({ key: DEVICE_ID_KEY, value: deviceId });
		await Preferences.set({ key: DEVICE_TOKEN_KEY, value: deviceToken });
	} else if (typeof localStorage !== 'undefined') {
		localStorage.setItem(DEVICE_ID_KEY, deviceId);
		localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
	}
}

/**
 * Get saved device credentials.
 * Uses Capacitor Preferences on native, localStorage in browser.
 */
export async function getDeviceCredentials(): Promise<{
	deviceId: string;
	deviceToken: string;
} | null> {
	if (isNative()) {
		const { value: deviceId } = await Preferences.get({ key: DEVICE_ID_KEY });
		const { value: deviceToken } = await Preferences.get({
			key: DEVICE_TOKEN_KEY
		});

		if (deviceId && deviceToken) {
			return { deviceId, deviceToken };
		}
		return null;
	}

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
 * Uses Capacitor Preferences on native, localStorage in browser.
 */
export async function clearDeviceCredentials(): Promise<void> {
	if (isNative()) {
		await Preferences.remove({ key: DEVICE_ID_KEY });
		await Preferences.remove({ key: DEVICE_TOKEN_KEY });
	} else if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(DEVICE_ID_KEY);
		localStorage.removeItem(DEVICE_TOKEN_KEY);
	}
}
