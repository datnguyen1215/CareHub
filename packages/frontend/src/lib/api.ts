/**
 * API client for CareHub backend endpoints.
 */

export interface ApiError {
	message: string;
	status: number;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(`/api${path}`, {
		method,
		headers: body ? { 'Content-Type': 'application/json' } : {},
		body: body ? JSON.stringify(body) : undefined,
		credentials: 'include'
	});

	if (!res.ok) {
		let message = `Request failed (${res.status})`;
		try {
			const data = await res.json();
			if (data?.message) message = data.message;
			else if (data?.error) message = data.error;
		} catch {
			// ignore parse errors
		}
		const err: ApiError = { message, status: res.status };
		throw err;
	}

	// 204 No Content
	if (res.status === 204) return undefined as T;

	return res.json() as Promise<T>;
}

// Auth

export function requestOtp(email: string) {
	return request<void>('POST', '/auth/request-otp', { email });
}

export function verifyOtp(email: string, code: string) {
	return request<void>('POST', '/auth/verify-otp', { email, code });
}

export function logout() {
	return request<void>('POST', '/auth/logout');
}

// Users

export interface MeResponse {
	id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
}

export function getMe() {
	return request<MeResponse>('GET', '/users/me');
}

export function updateMe(data: { first_name: string; last_name: string }) {
	return request<MeResponse>('PATCH', '/users/me', data);
}

// Groups

export interface Group {
	id: string;
	name: string;
	created_at: string;
}

export function listGroups() {
	return request<Group[]>('GET', '/groups');
}

// Care Profiles

export interface CareProfile {
	id: string;
	group_id: string;
	name: string;
	avatar_url: string | null;
	date_of_birth: string | null;
	relationship: string | null;
	conditions: string[];
	created_at: string;
	updated_at: string;
}

export interface CreateProfileInput {
	name: string;
	date_of_birth?: string | null;
	relationship?: string | null;
	conditions?: string[];
}

export function listProfiles(groupId: string) {
	return request<CareProfile[]>('GET', `/groups/${groupId}/profiles`);
}

export function createProfile(groupId: string, data: CreateProfileInput) {
	return request<CareProfile>('POST', `/groups/${groupId}/profiles`, data);
}

export function updateProfile(groupId: string, id: string, data: Partial<CreateProfileInput>) {
	return request<CareProfile>('PATCH', `/groups/${groupId}/profiles/${id}`, data);
}

export function deleteProfile(groupId: string, id: string) {
	return request<void>('DELETE', `/groups/${groupId}/profiles/${id}`);
}
