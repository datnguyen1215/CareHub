/**
 * Barrel export for backward compatibility.
 * Consumers can import from '$lib/api' as before,
 * or from individual modules (e.g., '$lib/api/profiles') for finer granularity.
 */

export { request, buildQueryString, isApiError } from './client';
export type { ApiError } from './client';

export { requestOtp, verifyOtp, logout, getWsTicket } from './auth';

export { getMe, updateMe } from './users';
export type { MeResponse } from './users';

export { listProfiles, createProfile, updateProfile, getProfile, deleteProfile } from './profiles';
export type { CareProfile, CreateProfileInput } from './profiles';

export { listMedications, createMedication, updateMedication, deleteMedication } from './medications';
export type { Medication, CreateMedicationInput } from './medications';

export { listEvents, createEvent, updateEvent, deleteEvent, getEvent } from './events';
export type { Event, CreateEventInput } from './events';

export {
	listJournalEntries,
	getJournalEntry,
	createJournalEntry,
	updateJournalEntry,
	deleteJournalEntry,
	listJournalEntriesByEvent
} from './journal';
export type { JournalEntry, CreateJournalEntryInput } from './journal';

export {
	uploadFile,
	isAttachmentProcessing,
	uploadAttachment,
	listAttachments,
	getAttachment,
	updateAttachment,
	deleteAttachment
} from './attachments';
export type {
	AttachmentCategory,
	Attachment,
	AttachmentFilters,
	UpdateAttachmentInput,
	UploadResponse
} from './attachments';

export {
	listDevices,
	getDevice,
	pairDevice,
	updateDevice,
	unpairDevice,
	assignProfilesToDevice,
	removeProfileFromDevice
} from './devices';
export type { Device, DeviceProfile } from './devices';

export { getLatestRelease, triggerDeviceUpdate } from './releases';
export type { Release } from './releases';
