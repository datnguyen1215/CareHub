import { describe, it, expect } from 'vitest';
import { getErrorMessage, isRetryable } from '$lib/utils/error-utils';
import type { ApiError } from '$lib/api';

// ─── getErrorMessage ──────────────────────────────────────

describe('getErrorMessage', () => {
	it('returns session expired message for 401', () => {
		const err: ApiError = { status: 401, message: 'Unauthorized' };
		expect(getErrorMessage(err, 'view profile')).toBe(
			'Your session has expired. Please log in again.'
		);
	});

	it('returns permission denied message for 403', () => {
		const err: ApiError = { status: 403, message: 'Forbidden' };
		expect(getErrorMessage(err, 'delete profile')).toContain('permission');
		expect(getErrorMessage(err, 'delete profile')).toContain('delete profile');
	});

	it('returns not found message for 404', () => {
		const err: ApiError = { status: 404, message: 'Not found' };
		expect(getErrorMessage(err, 'load medication')).toContain('Could not find');
		expect(getErrorMessage(err, 'load medication')).toContain('medication');
	});

	it('returns custom message from API for 4xx errors with message', () => {
		const err: ApiError = { status: 409, message: 'Email already registered' };
		expect(getErrorMessage(err, 'create account')).toBe(
			'Could not create account: Email already registered'
		);
	});

	it('returns server error message for 5xx', () => {
		const err: ApiError = { status: 500, message: 'Internal error' };
		const msg = getErrorMessage(err, 'save data');
		expect(msg).toContain('Server error');
		expect(msg).toContain('save data');
	});

	it('returns network error message for errors without status', () => {
		expect(getErrorMessage({}, 'sync')).toContain('Check your internet');
		expect(getErrorMessage({ message: 'fail' }, 'sync')).toContain('Check your internet');
	});

	it('returns fallback message for unknown error shapes', () => {
		expect(getErrorMessage(null as unknown, 'do thing')).toContain('Could not do thing');
		expect(getErrorMessage(undefined as unknown, 'do thing')).toContain('Could not do thing');
	});

	it('returns fallback for errors with only status 200 (unexpected)', () => {
		const err = { status: 200 };
		expect(getErrorMessage(err, 'test')).toContain('Please try again');
	});
});

// ─── isRetryable ──────────────────────────────────────────

describe('isRetryable', () => {
	it('returns true for network errors (no status)', () => {
		expect(isRetryable({})).toBe(true);
		expect(isRetryable(null)).toBe(true);
		expect(isRetryable({ message: 'Network error' })).toBe(true);
	});

	it('returns true for 5xx server errors', () => {
		expect(isRetryable({ status: 500, message: 'Internal' })).toBe(true);
		expect(isRetryable({ status: 502, message: 'Bad Gateway' })).toBe(true);
		expect(isRetryable({ status: 503, message: 'Service Unavailable' })).toBe(true);
	});

	it('returns false for 401 auth errors', () => {
		expect(isRetryable({ status: 401, message: 'Unauthorized' })).toBe(false);
	});

	it('returns false for 4xx client errors', () => {
		expect(isRetryable({ status: 400, message: 'Bad request' })).toBe(false);
		expect(isRetryable({ status: 403, message: 'Forbidden' })).toBe(false);
		expect(isRetryable({ status: 404, message: 'Not found' })).toBe(false);
		expect(isRetryable({ status: 409, message: 'Conflict' })).toBe(false);
	});

	it('returns true for values without status', () => {
		expect(isRetryable(undefined)).toBe(true); // no status -> retryable
		expect(isRetryable('string error' as unknown)).toBe(true); // no status -> retryable
	});
});
