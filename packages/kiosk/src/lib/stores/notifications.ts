/**
 * Notification store for displaying toast messages to users.
 * Designed for kiosk tablet interface with larger touch targets.
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
	id: string
	type: NotificationType
	message: string
}

/** Auto-dismiss timeouts by type (in milliseconds) */
const AUTO_DISMISS_MS: Record<NotificationType, number> = {
	success: 3000,
	info: 5000,
	warning: 5000,
	error: 10000
}

type NotificationListener = (notifications: Notification[]) => void

let notifications: Notification[] = []
const listeners = new Set<NotificationListener>()

function notify(): void {
	listeners.forEach((listener) => listener([...notifications]))
}

/**
 * Add a notification.
 * @param type - Notification type
 * @param message - User-friendly message to display
 * @returns Notification ID
 */
function add(type: NotificationType, message: string): string {
	const id = crypto.randomUUID()
	notifications = [...notifications, { id, type, message }]
	notify()

	const timeout = AUTO_DISMISS_MS[type]
	setTimeout(() => dismiss(id), timeout)

	return id
}

/**
 * Dismiss a notification by ID.
 * @param id - Notification ID to dismiss
 */
function dismiss(id: string): void {
	notifications = notifications.filter((n) => n.id !== id)
	notify()
}

/**
 * Clear all notifications.
 */
function clear(): void {
	notifications = []
	notify()
}

/**
 * Subscribe to notification changes.
 * @param listener - Callback invoked when notifications change
 * @returns Unsubscribe function
 */
function subscribe(listener: NotificationListener): () => void {
	listeners.add(listener)
	listener([...notifications])
	return () => {
		listeners.delete(listener)
	}
}

/**
 * Get current notifications (snapshot).
 * @returns Current notification array
 */
function getNotifications(): Notification[] {
	return [...notifications]
}

export const notification = {
	subscribe,
	getNotifications,
	success: (message: string) => add('success', message),
	error: (message: string) => add('error', message),
	warning: (message: string) => add('warning', message),
	info: (message: string) => add('info', message),
	dismiss,
	clear
}
