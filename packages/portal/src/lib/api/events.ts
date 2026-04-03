/**
 * Event API functions and types.
 */

import { request, buildQueryString } from './client';

export interface Event {
	id: string;
	care_profile_id: string;
	title: string;
	event_type: 'doctor_visit' | 'lab_work' | 'therapy' | 'general';
	event_date: string;
	location: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface CreateEventInput {
	title: string;
	event_type: 'doctor_visit' | 'lab_work' | 'therapy' | 'general';
	event_date: string;
	location?: string | null;
	notes?: string | null;
}

export function listEvents(profileId: string, start?: string, end?: string) {
	const qs = buildQueryString({ start, end });
	return request<Event[]>('GET', `/profiles/${profileId}/events${qs}`);
}

export function createEvent(profileId: string, data: CreateEventInput) {
	return request<Event>('POST', `/profiles/${profileId}/events`, data);
}

export function updateEvent(profileId: string, id: string, data: Partial<CreateEventInput>) {
	return request<Event>('PATCH', `/profiles/${profileId}/events/${id}`, data);
}

export function deleteEvent(profileId: string, id: string) {
	return request<void>('DELETE', `/profiles/${profileId}/events/${id}`);
}

export function getEvent(profileId: string, id: string) {
	return request<Event>('GET', `/profiles/${profileId}/events/${id}`);
}
