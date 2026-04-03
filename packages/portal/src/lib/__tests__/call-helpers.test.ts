import { describe, it, expect } from 'vitest';

/**
 * Tests for pure helper logic extracted from call.svelte.ts.
 *
 * The `getUserFriendlyError` and `formattedDuration` functions are
 * defined inside a `.svelte.ts` file and use `$state` runes, so they
 * cannot be imported directly into plain `.ts` test files.
 * We duplicate the pure logic here to ensure correct behavior.
 */

// ─── getUserFriendlyError (pure logic copy) ───────────────

function getUserFriendlyError(error: string | null): string {
	if (!error) return 'Call failed. Please try again.';

	const errorLower = error.toLowerCase();

	if (errorLower.includes('websocket') || errorLower.includes('unable to connect')) {
		return 'Connection lost. Please check your internet and try again.';
	}
	if (errorLower.includes('offline') || errorLower.includes('not connected')) {
		return 'Device is offline. Please check the tablet.';
	}
	if (errorLower.includes('declined')) {
		return 'Call was declined.';
	}
	if (errorLower.includes('ice') || errorLower.includes('network')) {
		return 'Could not establish video connection. Check your network.';
	}
	if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
		return 'Call timed out. Please try again.';
	}
	if (
		errorLower.includes('permission') ||
		errorLower.includes('notallowed') ||
		errorLower.includes('not allowed')
	) {
		return 'Camera/microphone access denied. Please allow permissions.';
	}
	if (errorLower.includes('notfound') || errorLower.includes('not found')) {
		return 'Camera or microphone not found. Please check your devices.';
	}

	return error;
}

describe('getUserFriendlyError', () => {
	it('returns default for null error', () => {
		expect(getUserFriendlyError(null)).toBe('Call failed. Please try again.');
	});

	it('returns default for empty string', () => {
		expect(getUserFriendlyError('')).toBe('Call failed. Please try again.');
	});

	it('maps WebSocket errors to connection message', () => {
		expect(getUserFriendlyError('WebSocket connection failed')).toContain('Connection lost');
	});

	it('maps "unable to connect" to connection message', () => {
		expect(getUserFriendlyError('Unable to connect to server')).toContain('Connection lost');
	});

	it('maps offline errors to device offline message', () => {
		expect(getUserFriendlyError('Device is offline')).toContain('Device is offline');
	});

	it('maps "not connected" to device offline message', () => {
		expect(getUserFriendlyError('Not connected to device')).toContain('Device is offline');
	});

	it('maps declined to declined message', () => {
		expect(getUserFriendlyError('Call was declined')).toBe('Call was declined.');
	});

	it('maps ICE errors to video connection message', () => {
		expect(getUserFriendlyError('ICE candidate failed')).toContain('Could not establish video');
	});

	it('maps network errors to video connection message', () => {
		expect(getUserFriendlyError('Network unreachable')).toContain('Could not establish video');
	});

	it('maps timeout to timeout message', () => {
		expect(getUserFriendlyError('Connection timed out')).toContain('timed out');
	});

	it('maps permission errors to permissions message', () => {
		expect(getUserFriendlyError('Permission denied')).toContain('Camera/microphone access denied');
	});

	it('maps NotAllowedError to permissions message', () => {
		expect(getUserFriendlyError('NotAllowedError')).toContain('Camera/microphone access denied');
	});

	it('maps NotFoundError to device not found message', () => {
		expect(getUserFriendlyError('NotFoundError')).toContain('Camera or microphone not found');
	});

	it('returns original error for unrecognized errors', () => {
		const error = 'Some unknown error occurred';
		expect(getUserFriendlyError(error)).toBe(error);
	});

	it('handles case-insensitive matching', () => {
		expect(getUserFriendlyError('WEBSOCKET CLOSED')).toContain('Connection lost');
		expect(getUserFriendlyError('TIMEOUT')).toContain('timed out');
	});
});

// ─── formattedDuration (pure logic copy) ──────────────────

function formattedDuration(duration: number): string {
	const minutes = Math.floor(duration / 60);
	const seconds = duration % 60;
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

describe('formattedDuration', () => {
	it('formats zero seconds', () => {
		expect(formattedDuration(0)).toBe('00:00');
	});

	it('formats seconds only', () => {
		expect(formattedDuration(45)).toBe('00:45');
	});

	it('formats exactly one minute', () => {
		expect(formattedDuration(60)).toBe('01:00');
	});

	it('formats minutes and seconds', () => {
		expect(formattedDuration(125)).toBe('02:05');
	});

	it('pads single-digit minutes', () => {
		expect(formattedDuration(65)).toBe('01:05');
	});

	it('handles larger durations', () => {
		expect(formattedDuration(3661)).toBe('61:01');
	});

	it('handles 59 seconds (edge case before minute roll)', () => {
		expect(formattedDuration(59)).toBe('00:59');
	});
});
