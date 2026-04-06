/**
 * Device API functions and types.
 */

import { request } from './client';

export interface DeviceProfile {
	id: string;
	name: string;
	avatar_url: string | null;
}

export interface Device {
	id: string;
	name: string;
	status: 'online' | 'offline';
	battery_level: number | null;
	last_seen_at: string | null;
	paired_at: string | null;
	created_at: string;
	profiles: DeviceProfile[];
	/** Current app version installed on the device, reported via heartbeat. Null if not yet reported. */
	app_version: string | null;
}

// Backend returns camelCase for single device responses.
// This normalization maps camelCase fields to snake_case to match
// the Device interface used by consumers (consistent with list responses).
// Backend returns camelCase for single device responses; list responses use snake_case already.
interface DeviceApiResponse {
	id: string;
	name: string;
	status: 'online' | 'offline';
	batteryLevel: number | null;
	lastSeenAt: string | null;
	pairedAt: string | null;
	createdAt: string;
	profiles: DeviceProfile[];
	appVersion: string | null;
}

export function listDevices() {
	return request<Device[]>('GET', '/devices');
}

export async function getDevice(id: string): Promise<Device> {
	const response = await request<DeviceApiResponse>('GET', `/devices/${id}`);
	return {
		id: response.id,
		name: response.name,
		status: response.status,
		battery_level: response.batteryLevel,
		last_seen_at: response.lastSeenAt,
		paired_at: response.pairedAt,
		created_at: response.createdAt,
		profiles: response.profiles,
		app_version: response.appVersion ?? null
	};
}

export function pairDevice(token: string, profileIds: string[]) {
	return request<Device>('POST', '/devices/pair', { token, profileIds });
}

export function updateDevice(id: string, data: { name: string }) {
	return request<Device>('PATCH', `/devices/${id}`, data);
}

export function unpairDevice(id: string) {
	return request<void>('DELETE', `/devices/${id}`);
}

export function assignProfilesToDevice(deviceId: string, profileIds: string[]) {
	return request<{ profiles: DeviceProfile[] }>('POST', `/devices/${deviceId}/profiles`, {
		profileIds
	});
}

export function removeProfileFromDevice(deviceId: string, profileId: string) {
	return request<void>('DELETE', `/devices/${deviceId}/profiles/${profileId}`);
}
