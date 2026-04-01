import { writable } from 'svelte/store'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'destructive'

export interface Toast {
	id: string
	type: ToastType
	message: string
}

/** Auto-dismiss timeouts by type (in milliseconds) */
const AUTO_DISMISS_MS: Record<ToastType, number | null> = {
	success: 3000,
	info: 5000,
	warning: 5000,
	destructive: 3000,
	error: 10000 // Errors stay longer but still auto-dismiss
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([])

	function add(type: ToastType, message: string) {
		const id = crypto.randomUUID()
		update((toasts) => [...toasts, { id, type, message }])

		const timeout = AUTO_DISMISS_MS[type]
		if (timeout !== null) {
			setTimeout(() => dismiss(id), timeout)
		}

		return id
	}

	function dismiss(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id))
	}

	return {
		subscribe,
		success: (message: string) => add('success', message),
		error: (message: string) => add('error', message),
		warning: (message: string) => add('warning', message),
		info: (message: string) => add('info', message),
		destructive: (message: string) => add('destructive', message),
		dismiss
	}
}

export const toast = createToastStore()
