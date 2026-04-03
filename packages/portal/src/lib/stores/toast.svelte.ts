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

/** Reactive toast array — components can import and reference directly */
const toastsState = $state<Toast[]>([])

/** Getter for the reactive toasts array */
export function getToasts(): Toast[] {
	return toastsState
}

function add(type: ToastType, message: string) {
	const id = crypto.randomUUID()
	toastsState.push({ id, type, message })

	const timeout = AUTO_DISMISS_MS[type]
	if (timeout !== null) {
		setTimeout(() => dismiss(id), timeout)
	}

	return id
}

function dismiss(id: string) {
	const index = toastsState.findIndex((t) => t.id === id)
	if (index !== -1) {
		toastsState.splice(index, 1)
	}
}

export const toast = {
	success: (message: string) => add('success', message),
	error: (message: string) => add('error', message),
	warning: (message: string) => add('warning', message),
	info: (message: string) => add('info', message),
	destructive: (message: string) => add('destructive', message),
	dismiss,
	clear: () => {
		toastsState.length = 0
	}
}
