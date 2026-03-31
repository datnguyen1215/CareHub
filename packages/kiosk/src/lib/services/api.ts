/** API client for kiosk device endpoints. */

import { getDeviceCredentials } from './storage';

const API_BASE = '/api';

/** API error type */
export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/** Profile type */
export interface Profile {
	id: string;
	name: string;
	avatar_url: string | null;
	date_of_birth?: string | null;
}

/** Caretaker type */
export interface Caretaker {
	id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	avatar_url: string | null;
}

/** Device info response */
export interface DeviceInfo {
	id: string;
	name: string;
	status: 'online' | 'offline';
	pairedAt: string | null;
	profiles: Profile[];
	caretakers: Caretaker[];
}

/** Pairing token response */
export interface PairingToken {
	token: string;
	expiresAt: string;
}

/** Registration response */
export interface RegistrationResponse {
	deviceId: string;
	deviceToken: string;
	name: string;
}

/**
 * Make authenticated request with device token.
 */
async function deviceFetch(path: string, options: RequestInit = {}): Promise<Response> {
	const creds = await getDeviceCredentials();
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...(options.headers || {})
	};

	if (creds) {
		(headers as Record<string, string>)['Authorization'] = `Bearer ${creds.deviceToken}`;
	}

	const response = await fetch(`${API_BASE}${path}`, {
		...options,
		headers
	});

	return response;
}

/**
 * Register a new device.
 * @returns {Promise<RegistrationResponse>}
 */
export async function registerDevice(): Promise<RegistrationResponse> {
	const response = await fetch(`${API_BASE}/devices/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	});

	if (!response.ok) {
		const data = await response.json();
		throw new ApiError(response.status, data.error || 'Registration failed');
	}

	return response.json();
}

/**
 * Get current device info (validates token).
 * @returns {Promise<DeviceInfo>}
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
	const response = await deviceFetch('/devices/me');

	if (!response.ok) {
		const data = await response.json();
		throw new ApiError(response.status, data.error || 'Failed to get device info');
	}

	return response.json();
}

/**
 * Generate a new pairing token (QR code content).
 * @returns {Promise<PairingToken>}
 */
export async function generatePairingToken(): Promise<PairingToken> {
	const response = await deviceFetch('/devices/pairing-token', { method: 'POST' });

	if (!response.ok) {
		const data = await response.json();
		throw new ApiError(response.status, data.error || 'Failed to generate pairing token');
	}

	return response.json();
}

/**
 * Check pairing status.
 * @returns {Promise<{ paired: boolean, pairedAt: string | null }>}
 */
export async function checkPairingStatus(): Promise<{ paired: boolean; pairedAt: string | null }> {
	const response = await deviceFetch('/devices/pairing-status');

	if (!response.ok) {
		const data = await response.json();
		throw new ApiError(response.status, data.error || 'Failed to check pairing status');
	}

	return response.json();
}
