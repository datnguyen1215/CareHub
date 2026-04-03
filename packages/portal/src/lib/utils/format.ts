/**
 * Shared date formatting, time formatting, and string utilities.
 * Framework-agnostic (no Svelte imports).
 */

// --- Date formatting ---

function toDate(input: Date | string): Date {
	if (input instanceof Date) return input;
	return new Date(input);
}

/**
 * Format a date as "Mar 5"
 */
export function formatDateShort(input: Date | string): string {
	const d = toDate(input);
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date as "March 5, 2026"
 */
export function formatDateLong(input: Date | string): string {
	const d = toDate(input);
	return d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

/**
 * Format a date as "Mar 5, 2026"
 */
export function formatDateFull(input: Date | string): string {
	const d = toDate(input);
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

/**
 * Format a date+time as "March 5, 2026, 2:30 PM"
 */
export function formatDateTime(input: Date | string): string {
	const d = toDate(input);
	return d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

/**
 * Format a time as "2:30 PM"
 */
export function formatTime(input: Date | string): string {
	const d = toDate(input);
	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}).format(d);
}

/**
 * Format a date as a weekday label: "Wednesday, Mar 5"
 */
export function formatWeekdayLong(input: Date | string): string {
	const d = toDate(input);
	return new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric'
	}).format(d);
}

/**
 * Format month+year: "March 2026"
 */
export function formatMonthYear(input: Date | string): string {
	const d = toDate(input);
	return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
}

/**
 * Relative time: "Just now", "5m ago", "2h ago", "Yesterday", "3d ago"
 */
export function formatRelativeTime(dateStr: string | null): string {
	if (!dateStr) return 'Never';
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays === 1) return 'Yesterday';
	return `${diffDays}d ago`;
}

/**
 * Format a date using the browser's default locale (e.g., "1/15/2000" in en-US).
 * Use this only for backward compatibility with existing display behavior.
 */
export function formatDateDefault(input: Date | string): string {
	const d = toDate(input);
	return d.toLocaleDateString();
}

// --- String utilities ---

/**
 * Return the uppercased first character of a name.
 * Returns '?' if the name is empty.
 */
export function getInitial(name: string): string {
	if (!name) return '?';
	return name.charAt(0).toUpperCase();
}
