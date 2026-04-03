import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toast } from '$lib/stores/toast';

describe('Toast store', () => {
	beforeEach(() => {
		// Clear all toasts between tests
		const allToasts = get(toast);
		allToasts.forEach((t) => toast.dismiss(t.id));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts with empty toasts', () => {
		expect(get(toast)).toEqual([]);
	});

	it('adds a success toast', () => {
		toast.success('Profile saved');
		const toasts = get(toast);
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe('success');
		expect(toasts[0].message).toBe('Profile saved');
	});

	it('adds an error toast', () => {
		toast.error('Something went wrong');
		const toasts = get(toast);
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe('error');
		expect(toasts[0].message).toBe('Something went wrong');
	});

	it('adds a warning toast', () => {
		toast.warning('Careful!');
		const toasts = get(toast);
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe('warning');
	});

	it('adds an info toast', () => {
		toast.info('FYI');
		const toasts = get(toast);
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe('info');
	});

	it('dismisses a toast by id', () => {
		const id = toast.success('Will be dismissed');
		expect(get(toast)).toHaveLength(1);
		toast.dismiss(id);
		expect(get(toast)).toHaveLength(0);
	});

	it('auto-dismisses success toast after timeout', () => {
		vi.useFakeTimers();
		const id = toast.success('Auto dismiss');
		expect(get(toast)).toHaveLength(1);

		vi.advanceTimersByTime(3000);
		expect(get(toast)).toHaveLength(0);
	});

	it('auto-dismisses info toast after 5 seconds', () => {
		vi.useFakeTimers();
		toast.info('Info toast');

		vi.advanceTimersByTime(4999);
		expect(get(toast)).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(get(toast)).toHaveLength(0);
	});

	it('auto-dismisses error toast after 10 seconds', () => {
		vi.useFakeTimers();
		toast.error('Error toast');

		vi.advanceTimersByTime(9999);
		expect(get(toast)).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(get(toast)).toHaveLength(0);
	});

	it('supports multiple simultaneous toasts', () => {
		toast.success('First');
		toast.info('Second');
		toast.warning('Third');
		expect(get(toast)).toHaveLength(3);
	});

	it('generates unique IDs for each toast', () => {
		const id1 = toast.success('A');
		const id2 = toast.success('B');
		expect(id1).not.toBe(id2);
	});
});
