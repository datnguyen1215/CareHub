/**
 * Medication API functions and types.
 */

import { request, buildQueryString } from './client';

export interface Medication {
	id: string;
	care_profile_id: string;
	name: string;
	dosage: string | null;
	schedule: string[];
	status: 'active' | 'discontinued';
	created_at: string;
	updated_at: string;
}

export interface CreateMedicationInput {
	name: string;
	dosage?: string | null;
	schedule?: string[];
	status?: 'active' | 'discontinued';
}

export function listMedications(profileId: string, includeDiscontinued = false) {
	const qs = buildQueryString({
		include_discontinued: includeDiscontinued ? 'true' : undefined
	});
	return request<Medication[]>('GET', `/profiles/${profileId}/medications${qs}`);
}

export function createMedication(profileId: string, data: CreateMedicationInput) {
	return request<Medication>('POST', `/profiles/${profileId}/medications`, data);
}

export function updateMedication(
	profileId: string,
	id: string,
	data: Partial<CreateMedicationInput>
) {
	return request<Medication>('PATCH', `/profiles/${profileId}/medications/${id}`, data);
}

export function deleteMedication(profileId: string, id: string) {
	return request<void>('DELETE', `/profiles/${profileId}/medications/${id}`);
}
