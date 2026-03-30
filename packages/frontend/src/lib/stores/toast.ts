import { writable } from 'svelte/store'

export type ToastType = 'success' | 'error' | 'destructive'

export interface Toast {
	id: string
	type: ToastType
	message: string
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([])

	function add(type: ToastType, message: string) {
		const id = crypto.randomUUID()
		update((toasts) => [...toasts, { id, type, message }])

		// Auto-dismiss after 3 seconds for success and destructive
		if (type === 'success' || type === 'destructive') {
			setTimeout(() => dismiss(id), 3000)
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
		destructive: (message: string) => add('destructive', message),
		dismiss
	}
}

export const toast = createToastStore()
