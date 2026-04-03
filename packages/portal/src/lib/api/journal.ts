/**
 * Journal entry API functions and types.
 */

import { request, buildQueryString } from './client';

export interface JournalEntry {
	id: string;
	care_profile_id: string;
	title: string;
	content: string;
	key_takeaways: string | null;
	entry_date: string;
	linked_event_id: string | null;
	starred: boolean;
	attachment_count?: number;
	created_at: string;
	updated_at: string;
}

export interface CreateJournalEntryInput {
	title: string;
	content: string;
	entry_date: string;
	key_takeaways?: string | null;
	linked_event_id?: string | null;
	starred?: boolean;
}

export function listJournalEntries(profileId: string, search?: string, sort?: 'recent' | 'oldest') {
	const qs = buildQueryString({ search, sort });
	return request<JournalEntry[]>('GET', `/profiles/${profileId}/journal${qs}`);
}

export function getJournalEntry(profileId: string, id: string) {
	return request<JournalEntry>('GET', `/profiles/${profileId}/journal/${id}`);
}

export function createJournalEntry(profileId: string, data: CreateJournalEntryInput) {
	return request<JournalEntry>('POST', `/profiles/${profileId}/journal`, data);
}

export function updateJournalEntry(
	profileId: string,
	id: string,
	data: Partial<CreateJournalEntryInput>
) {
	return request<JournalEntry>('PATCH', `/profiles/${profileId}/journal/${id}`, data);
}

export function deleteJournalEntry(profileId: string, id: string) {
	return request<void>('DELETE', `/profiles/${profileId}/journal/${id}`);
}

export function listJournalEntriesByEvent(profileId: string, eventId: string) {
	return request<JournalEntry[]>('GET', `/profiles/${profileId}/journal/by-event/${eventId}`);
}
