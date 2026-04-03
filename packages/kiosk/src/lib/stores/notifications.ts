/**
 * Notification store for displaying toast messages to users.
 * Designed for kiosk tablet interface with larger touch targets.
 *
 * Backed by shared toast logic from @carehub/shared.
 */

import { createToastStore, type Toast as SharedToast } from '@carehub/shared/ui/toast'

/** Re-export as Notification for backward compatibility */
export type Notification = SharedToast

/** Re-export type alias */
export type NotificationType = SharedToast['type']

/** Underlying shared toast store */
const store = createToastStore()

export const notification = {
	subscribe: store.subscribe,
	getNotifications: store.getToasts,
	success: (message: string) => store.add('success', message),
	error: (message: string) => store.add('error', message),
	warning: (message: string) => store.add('warning', message),
	info: (message: string) => store.add('info', message),
	dismiss: store.dismiss,
	clear: store.clear
}
