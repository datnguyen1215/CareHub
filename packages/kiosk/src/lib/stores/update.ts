/**
 * Update state store for tracking OTA app update lifecycle.
 *
 * Shape:
 *   updateStatus  — current phase of the update process
 *   updateProgress — download completion percentage (0–100)
 *   updateError   — human-readable error message when status is 'failed', otherwise null
 */

/** Possible phases of an OTA update. */
export type UpdateStatus = 'idle' | 'downloading' | 'installing' | 'success' | 'failed';

/** Reactive update state. */
export interface UpdateState {
	/** Current phase of the update. */
	updateStatus: UpdateStatus;
	/** Download progress percentage (0–100). Meaningful only while `updateStatus` is 'downloading'. */
	updateProgress: number;
	/** Error message when `updateStatus` is 'failed', otherwise `null`. */
	updateError: string | null;
}

type UpdateStateListener = (state: UpdateState) => void;

let state: UpdateState = {
	updateStatus: 'idle',
	updateProgress: 0,
	updateError: null
};

const listeners: Set<UpdateStateListener> = new Set();

/** Notify all subscribers with the current state. */
function notify(): void {
	const snapshot = { ...state };
	listeners.forEach((fn) => fn(snapshot));
}

/**
 * Subscribe to update state changes.
 * @param listener - Called immediately with the current state and on every change.
 * @returns Unsubscribe function.
 */
export function subscribe(listener: UpdateStateListener): () => void {
	listeners.add(listener);
	listener({ ...state });
	return () => listeners.delete(listener);
}

/**
 * Get a snapshot of the current update state.
 * @returns Current {@link UpdateState}.
 */
export function getUpdateState(): UpdateState {
	return { ...state };
}

/**
 * Set update status and optionally reset progress/error.
 * @param status - New update status.
 * @param extra - Optional fields to merge into the state.
 */
export function setUpdateStatus(
	status: UpdateStatus,
	extra: Partial<Pick<UpdateState, 'updateProgress' | 'updateError'>> = {}
): void {
	state = {
		...state,
		updateStatus: status,
		updateProgress: extra.updateProgress ?? (status === 'idle' ? 0 : state.updateProgress),
		updateError: extra.updateError ?? (status !== 'failed' ? null : state.updateError)
	};
	notify();
}

/**
 * Update download progress percentage.
 * @param percent - Value between 0 and 100.
 */
export function setUpdateProgress(percent: number): void {
	state = { ...state, updateProgress: percent };
	notify();
}
