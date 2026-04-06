/**
 * Release API functions and types.
 */

import { request } from './client';

export interface Release {
	id: string;
	app: string;
	version: string;
	notes: string | null;
	created_at: string;
}

/**
 * Fetches the latest available release for the given app.
 * Returns undefined (204) if no releases have been published yet.
 * @param app - The app identifier (e.g. "kiosk")
 */
export function getLatestRelease(app: string): Promise<Release | undefined> {
	return request<Release>('GET', `/releases/latest?app=${encodeURIComponent(app)}`);
}

/**
 * Triggers an OTA update on the given device to install the specified release.
 * The device must be online; the backend will push the update via WebSocket.
 * @param deviceId - The device to update
 * @param releaseId - The release ID to install
 */
export function triggerDeviceUpdate(deviceId: string, releaseId: string): Promise<void> {
	return request<void>('POST', `/devices/${deviceId}/update`, { releaseId });
}
