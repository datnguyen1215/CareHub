/**
 * Shared toast notification store logic.
 * Framework-agnostic — apps wrap in their reactive system.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'destructive'

export interface Toast {
	id: string
	type: ToastType
	message: string
}

/** Default auto-dismiss timeouts by type (in milliseconds). `null` = no auto-dismiss. */
export const DEFAULT_AUTO_DISMISS_MS: Record<ToastType, number | null> = {
	success: 3000,
	info: 5000,
	warning: 5000,
	destructive: 3000,
	error: 10000
}

type ToastListener = (toasts: Toast[]) => void

export interface ToastStore {
	add: (type: ToastType, message: string) => string
	dismiss: (id: string) => void
	clear: () => void
	subscribe: (listener: ToastListener) => () => void
	getToasts: () => Toast[]
}

/**
 * Create a framework-agnostic toast store.
 *
 * @param autoDismissMs - Override default auto-dismiss durations per type
 */
export function createToastStore(
	autoDismissMs: Partial<Record<ToastType, number | null>> = {}
): ToastStore {
	const durations: Record<ToastType, number | null> = {
		...DEFAULT_AUTO_DISMISS_MS,
		...autoDismissMs
	}

	let toasts: Toast[] = []
	const listeners = new Set<ToastListener>()

	function notify(): void {
		listeners.forEach((fn) => fn([...toasts]))
	}

	function add(type: ToastType, message: string): string {
		const id = crypto.randomUUID()
		toasts = [...toasts, { id, type, message }]
		notify()

		const timeout = durations[type]
		if (timeout !== null && timeout !== undefined) {
			setTimeout(() => dismiss(id), timeout)
		}

		return id
	}

	function dismiss(id: string): void {
		toasts = toasts.filter((t) => t.id !== id)
		notify()
	}

	function clear(): void {
		toasts = []
		notify()
	}

	function subscribe(listener: ToastListener): () => void {
		listeners.add(listener)
		listener([...toasts])
		return () => {
			listeners.delete(listener)
		}
	}

	function getToasts(): Toast[] {
		return [...toasts]
	}

	return { add, dismiss, clear, subscribe, getToasts }
}
