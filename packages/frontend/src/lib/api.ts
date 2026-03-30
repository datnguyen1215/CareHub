/**
 * API client for CareHub backend endpoints.
 */

export interface ApiError {
	message: string;
	status: number;
}

/**
 * Type guard to check if an error is an ApiError.
 */
export function isApiError(err: unknown): err is ApiError {
	return typeof err === 'object' && err !== null && 'status' in err && 'message' in err;
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

// Care Profiles

export interface CareProfile {
	id: string;
	user_id: string;
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

// Medications

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
	const qs = includeDiscontinued ? '?include_discontinued=true' : '';
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

// Events

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
	let qs = '';
	const params = [];
	if (start) params.push(`start=${encodeURIComponent(start)}`);
	if (end) params.push(`end=${encodeURIComponent(end)}`);
	if (params.length > 0) qs = `?${params.join('&')}`;
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

// Journal Entries

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
	const params = [];
	if (search) params.push(`search=${encodeURIComponent(search)}`);
	if (sort) params.push(`sort=${encodeURIComponent(sort)}`);
	const qs = params.length > 0 ? `?${params.join('&')}` : '';
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

// File Upload

export interface UploadResponse {
	url: string;
}

/** Uploads a file and returns the URL */
export async function uploadFile(file: File): Promise<string> {
	const formData = new FormData();
	formData.append('file', file);

	const res = await fetch('/api/upload', {
		method: 'POST',
		body: formData,
		credentials: 'include'
	});

	if (!res.ok) {
		let message = `Upload failed (${res.status})`;
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

	const data = (await res.json()) as UploadResponse;
	return data.url;
}

// Attachments

export type AttachmentCategory =
	| 'lab_result'
	| 'prescription'
	| 'insurance'
	| 'billing'
	| 'imaging'
	| 'other';

export interface Attachment {
	id: string;
	profile_id: string;
	event_id: string | null;
	journal_id: string | null;
	file_url: string;
	description: string | null;
	ocr_text: string | null;
	category: AttachmentCategory;
	created_at: string;
	updated_at: string;
}

/** Checks if an attachment is still processing (OCR/AI not complete) */
export function isAttachmentProcessing(attachment: Attachment): boolean {
	// Processing is considered complete when ocr_text has been set (even if null on failure)
	// or if the file type doesn't support OCR (non-image/pdf)
	const isImage = /\.(jpg|jpeg|png|gif|webp|pdf)$/i.test(attachment.file_url);
	if (!isImage) return false;

	// If created recently (within 5 minutes) and no ocr_text, likely still processing
	const createdAt = new Date(attachment.created_at);
	const now = new Date();
	const ageMs = now.getTime() - createdAt.getTime();
	const fiveMinutes = 5 * 60 * 1000;

	// If older than 5 minutes without OCR, assume processing failed silently
	if (ageMs > fiveMinutes) return false;

	// Check if updated after creation (indicates processing complete)
	const updatedAt = new Date(attachment.updated_at);
	const processedAfterCreation = updatedAt.getTime() > createdAt.getTime() + 1000; // 1s buffer

	return !processedAfterCreation;
}

export interface AttachmentFilters {
	event_id?: string;
	journal_id?: string;
	category?: AttachmentCategory;
	limit?: number;
}

export interface UpdateAttachmentInput {
	description?: string | null;
	category?: AttachmentCategory;
}

/** Uploads a file and creates an attachment linked to an event or journal entry */
export async function uploadAttachment(
	profileId: string,
	file: File,
	category: AttachmentCategory,
	options: { event_id?: string; journal_id?: string; description?: string }
): Promise<Attachment> {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('category', category);
	if (options.event_id) formData.append('event_id', options.event_id);
	if (options.journal_id) formData.append('journal_id', options.journal_id);
	if (options.description) formData.append('description', options.description);

	const res = await fetch(`/api/profiles/${profileId}/attachments`, {
		method: 'POST',
		body: formData,
		credentials: 'include'
	});

	if (!res.ok) {
		let message = `Upload failed (${res.status})`;
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

	return res.json() as Promise<Attachment>;
}

/** Lists attachments for a profile with optional filters */
export function listAttachments(profileId: string, filters?: AttachmentFilters) {
	const params = [];
	if (filters?.event_id) params.push(`event_id=${encodeURIComponent(filters.event_id)}`);
	if (filters?.journal_id) params.push(`journal_id=${encodeURIComponent(filters.journal_id)}`);
	if (filters?.category) params.push(`category=${encodeURIComponent(filters.category)}`);
	if (filters?.limit) params.push(`limit=${filters.limit}`);
	const qs = params.length > 0 ? `?${params.join('&')}` : '';
	return request<Attachment[]>('GET', `/profiles/${profileId}/attachments${qs}`);
}

/** Gets a single attachment by ID */
export function getAttachment(profileId: string, attachmentId: string) {
	return request<Attachment>('GET', `/profiles/${profileId}/attachments/${attachmentId}`);
}

/** Updates attachment metadata (description, category) */
export function updateAttachment(
	profileId: string,
	attachmentId: string,
	data: UpdateAttachmentInput
) {
	return request<Attachment>('PATCH', `/profiles/${profileId}/attachments/${attachmentId}`, data);
}

/** Deletes an attachment and its file */
export function deleteAttachment(profileId: string, attachmentId: string) {
	return request<void>('DELETE', `/profiles/${profileId}/attachments/${attachmentId}`);
}
