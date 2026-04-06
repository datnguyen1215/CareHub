import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	isApiError,
	type ApiError
} from '$lib/api';
import {
	requestOtp,
	verifyOtp,
	logout,
	getMe,
	updateMe,
	listProfiles,
	createProfile,
	deleteProfile,
	isAttachmentProcessing,
	type Attachment
} from '$lib/api';

// ─── isApiError ───────────────────────────────────────────

describe('isApiError', () => {
	it('returns true for objects with status and message', () => {
		expect(isApiError({ status: 404, message: 'Not found' })).toBe(true);
	});

	it('returns false for null', () => {
		expect(isApiError(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isApiError(undefined)).toBe(false);
	});

	it('returns false for plain string', () => {
		expect(isApiError('error')).toBe(false);
	});

	it('returns false for object missing status', () => {
		expect(isApiError({ message: 'No status' })).toBe(false);
	});

	it('returns false for object missing message', () => {
		expect(isApiError({ status: 500 })).toBe(false);
	});
});

// ─── request() via public functions ───────────────────────

describe('request() behavior via public API', () => {
	const originalFetch = globalThis.fetch;
	const mockFetch = vi.fn();

	beforeEach(() => {
		globalThis.fetch = mockFetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		mockFetch.mockReset();
	});

	it('parses JSON response on success', async () => {
		const data = { id: '1', email: 'test@example.com' };
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => data
		});

		const result = await getMe();
		expect(result).toEqual(data);
		expect(mockFetch).toHaveBeenCalledWith('/api/users/me', {
			method: 'GET',
			headers: {},
			body: undefined,
			credentials: 'include'
		});
	});

	it('handles 204 No Content by returning undefined', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 204
		});

		const result = await logout();
		expect(result).toBeUndefined();
	});

	it('throws ApiError with status and extracted message from response body', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 409,
			json: async () => ({ message: 'Email already registered' })
		});

		await expect(requestOtp('test@example.com')).rejects.toEqual({
			message: 'Email already registered',
			status: 409
		});
	});

	it('falls back to "error" field when "message" is absent', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: async () => ({ error: 'Bad input' })
		});

		await expect(verifyOtp('a@b.com', '123')).rejects.toEqual({
			message: 'Bad input',
			status: 400
		});
	});

	it('falls back to default message when body has no message/error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({ detail: 'something' })
		});

		await expect(getMe()).rejects.toEqual({
			message: 'Request failed (500)',
			status: 500
		});
	});

	it('falls back to default message when response body is not JSON', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 502,
			json: async () => {
				throw new Error('Not JSON');
			}
		});

		await expect(getMe()).rejects.toEqual({
			message: 'Request failed (502)',
			status: 502
		});
	});

	it('sends JSON body for POST requests', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ id: '1', name: 'Test' })
		});

		await createProfile({ name: 'Test' });
		expect(mockFetch).toHaveBeenCalledWith(
			'/api/profiles',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Test' })
			})
		);
	});

	it('sends JSON body for PATCH requests', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ id: '1', first_name: 'John', last_name: 'Doe' })
		});

		await updateMe({ first_name: 'John', last_name: 'Doe' });
		expect(mockFetch).toHaveBeenCalledWith(
			'/api/users/me',
			expect.objectContaining({
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ first_name: 'John', last_name: 'Doe' })
			})
		);
	});

	it('includes credentials: include in all requests', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 204
		});

		await deleteProfile('abc');
		expect(mockFetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ credentials: 'include' })
		);
	});
});

// ─── isAttachmentProcessing ───────────────────────────────

describe('isAttachmentProcessing', () => {
	const NOW = new Date('2025-01-01T12:00:00Z').getTime();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const now = new Date(NOW);

	function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
		return {
			id: '1',
			profile_id: 'p1',
			event_id: null,
			journal_id: null,
			file_url: 'photo.jpg',
			description: null,
			ocr_text: null,
			category: 'other',
			created_at: now.toISOString(),
			updated_at: now.toISOString(),
			...overrides
		};
	}

	it('returns false for non-image/pdf files', () => {
		const att = makeAttachment({ file_url: 'document.docx' });
		expect(isAttachmentProcessing(att)).toBe(false);
	});

	it('returns false for images older than 5 minutes', () => {
		const oldDate = new Date(now.getTime() - 6 * 60 * 1000).toISOString();
		const att = makeAttachment({
			created_at: oldDate,
			updated_at: oldDate,
			file_url: 'scan.jpg'
		});
		expect(isAttachmentProcessing(att)).toBe(false);
	});

	it('returns true for recent image without updated_at change', () => {
		const att = makeAttachment({
			created_at: now.toISOString(),
			updated_at: now.toISOString(),
			file_url: 'photo.jpg'
		});
		expect(isAttachmentProcessing(att)).toBe(true);
	});

	it('returns false for recent image that has been updated after creation', () => {
		const createdAt = now.toISOString();
		const updatedAt = new Date(now.getTime() + 5000).toISOString();
		const att = makeAttachment({
			created_at: createdAt,
			updated_at: updatedAt,
			file_url: 'photo.jpg'
		});
		expect(isAttachmentProcessing(att)).toBe(false);
	});

	it('returns true for image created 2 minutes ago, same updated_at', () => {
		const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
		const att = makeAttachment({
			created_at: twoMinAgo,
			updated_at: twoMinAgo,
			file_url: 'scan.png'
		});
		expect(isAttachmentProcessing(att)).toBe(true);
	});

	it('handles PDF files (supported OCR types)', () => {
		const recent = now.toISOString();
		const att = makeAttachment({
			created_at: recent,
			updated_at: recent,
			file_url: 'report.pdf'
		});
		expect(isAttachmentProcessing(att)).toBe(true);
	});

	it('handles JPEG extension case-insensitively', () => {
		const recent = now.toISOString();
		const att = makeAttachment({
			created_at: recent,
			updated_at: recent,
			file_url: 'PHOTO.JPG'
		});
		expect(isAttachmentProcessing(att)).toBe(true);
	});
});
