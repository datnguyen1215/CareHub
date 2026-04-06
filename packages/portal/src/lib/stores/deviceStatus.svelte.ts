/**
 * Reactive device status store.
 * Seeded from REST API responses on initial load and updated in real-time
 * via `device_status_changed` WebSocket events.
 */

import type { Device } from '$lib/api';
import * as websocket from '$lib/services/websocket';

/** Map of deviceId → current status */
const statusMap = $state<Map<string, 'online' | 'offline'>>(new Map());

/**
 * Returns the live status for a device, falling back to the REST-loaded
 * status if no WebSocket update has arrived yet.
 */
export function getDeviceStatus(deviceId: string, fallback: 'online' | 'offline'): 'online' | 'offline' {
	return statusMap.get(deviceId) ?? fallback;
}

/**
 * Seeds the store from an array of devices loaded via REST.
 * Called after listDevices() or getDevice() resolves.
 */
export function seedDeviceStatuses(devices: Device[]): void {
	for (const device of devices) {
		// Only seed if we don't already have a live value from a WS event
		if (!statusMap.has(device.id)) {
			statusMap.set(device.id, device.status);
		}
	}
}

/**
 * Directly updates a single device status.
 * Used when a single device is loaded (e.g. device detail page).
 */
export function seedDeviceStatus(device: Device): void {
	if (!statusMap.has(device.id)) {
		statusMap.set(device.id, device.status);
	}
}

/**
 * Sets up a WebSocket listener for `device_status_changed` messages.
 * Should be called once (from the app layout) and cleaned up on unmount.
 * @returns Cleanup function to remove the listener
 */
export function initializeDeviceStatusHandlers(): () => void {
	return websocket.onMessage((message) => {
		if (message.type === 'device_status_changed') {
			statusMap.set(message.deviceId, message.status);
		}
	});
}
