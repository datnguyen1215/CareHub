/**
 * Shared category color and label maps for attachment categories.
 * Framework-agnostic (no Svelte imports).
 */

/** Tailwind classes for attachment category badges */
export const CATEGORY_COLORS: Record<string, string> = {
	lab_result: 'bg-green-50 text-green-700 border-green-200',
	prescription: 'bg-blue-50 text-blue-700 border-blue-200',
	insurance: 'bg-purple-50 text-purple-700 border-purple-200',
	billing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
	imaging: 'bg-pink-50 text-pink-700 border-pink-200',
	other: 'bg-gray-50 text-gray-700 border-gray-200'
};

/** Human-readable labels for attachment categories */
export const CATEGORY_LABELS: Record<string, string> = {
	lab_result: 'Lab Result',
	prescription: 'Prescription',
	insurance: 'Insurance',
	billing: 'Billing',
	imaging: 'Imaging',
	other: 'Other'
};

/** Tailwind classes for event type badges */
export const EVENT_TYPE_COLORS: Record<string, string> = {
	doctor_visit: 'bg-blue-50 text-blue-700 border-blue-200',
	lab_work: 'bg-purple-50 text-purple-700 border-purple-200',
	therapy: 'bg-green-50 text-green-700 border-green-200',
	general: 'bg-gray-50 text-gray-700 border-gray-200'
};

/** Human-readable labels for event types */
export const EVENT_TYPE_LABELS: Record<string, string> = {
	doctor_visit: 'Doctor Visit',
	lab_work: 'Lab Work',
	therapy: 'Therapy',
	general: 'General'
};
