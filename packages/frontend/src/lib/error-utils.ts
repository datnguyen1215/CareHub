/**
 * Utility functions for handling and displaying user-friendly error messages.
 */

import type { ApiError } from './api';

/**
 * Converts an API error into a user-friendly message with actionable guidance.
 */
export function getErrorMessage(err: unknown, context: string): string {
	const apiErr = err as ApiError;

	// Handle authentication errors
	if (apiErr?.status === 401) {
		return 'Your session has expired. Please log in again.';
	}

	// Handle permission errors
	if (apiErr?.status === 403) {
		return `You don't have permission to ${context}. Contact your administrator.`;
	}

	// Handle not found errors
	if (apiErr?.status === 404) {
		return `Could not find the requested ${context}. It may have been deleted.`;
	}

	// Handle client errors with custom message (before generic 5xx check)
	if (apiErr?.message && apiErr?.status && apiErr.status >= 400 && apiErr.status < 500) {
		return `Could not ${context}: ${apiErr.message}`;
	}

	// Handle server errors
	if (apiErr?.status && apiErr.status >= 500) {
		return `Server error while trying to ${context}. Please try again in a few moments.`;
	}

	// Handle network/connection errors (no status code)
	if (!apiErr?.status) {
		return `Could not ${context}. Check your internet connection and try again.`;
	}

	// Fallback
	return `Could not ${context}. Please try again.`;
}

/**
 * Determines if an error is recoverable with a retry.
 */
export function isRetryable(err: unknown): boolean {
	const apiErr = err as ApiError;

	// Network errors (no status) are retryable
	if (!apiErr?.status) return true;

	// Server errors (5xx) are retryable
	if (apiErr.status >= 500) return true;

	// Auth errors should redirect to login, not retry
	if (apiErr.status === 401) return false;

	// Other 4xx errors are generally not retryable
	if (apiErr.status >= 400 && apiErr.status < 500) return false;

	return false;
}
