/**
 * Care profile API functions and types.
 */

import { request } from './client';

export interface CareProfile {
	id: string;
	user_id: string;
	name: string;
	avatar_url: string | null;
	date_of_birth: string | null;
	relationship: string | null;
	conditions: string[];
	medication_count?: number;
	created_at: string;
	updated_at: string;
}

export interface CreateProfileInput {
	name: string;
	date_of_birth?: string | null;
	relationship?: string | null;
	conditions?: string[];
	avatar_url?: string | null;
}

export function listProfiles() {
	return request<CareProfile[]>('GET', '/profiles');
}

export function createProfile(data: CreateProfileInput) {
	return request<CareProfile>('POST', '/profiles', data);
}

export function updateProfile(id: string, data: Partial<CreateProfileInput>) {
	return request<CareProfile>('PATCH', `/profiles/${id}`, data);
}

export function getProfile(id: string) {
	return request<CareProfile>('GET', `/profiles/${id}`);
}

export function deleteProfile(id: string) {
	return request<void>('DELETE', `/profiles/${id}`);
}
