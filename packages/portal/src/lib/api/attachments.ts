/**
 * Attachment API functions, upload helpers, and types.
 */

import { request, buildQueryString } from './client';
import type { ApiError } from './client';

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

export interface AttachmentFilters {
	event_id?: string;
	journal_id?: string;
	category?: AttachmentCategory;
	limit?: number;
	offset?: number;
	search?: string;
}

export interface UpdateAttachmentInput {
	description?: string | null;
	category?: AttachmentCategory;
}

export interface UploadResponse {
	url: string;
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
	const qs = buildQueryString({
		event_id: filters?.event_id,
		journal_id: filters?.journal_id,
		category: filters?.category,
		limit: filters?.limit,
		offset: filters?.offset,
		search: filters?.search
	});
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
