import { createToastStore, type Toast, type ToastType } from '@carehub/shared/ui/toast'

/** Underlying framework-agnostic store */
const store = createToastStore()

/** Reactive toast array — components can import and reference directly */
const toastsState = $state<Toast[]>([])

/** Sync shared store → reactive state */
store.subscribe((items) => {
	toastsState.length = 0
	for (const t of items) toastsState.push(t)
})

/** Getter for the reactive toasts array */
export function getToasts(): Toast[] {
	return toastsState
}

/** Convenience type re-exports */
export type { Toast, ToastType }

export const toast = {
	success: (message: string) => store.add('success', message),
	error: (message: string) => store.add('error', message),
	warning: (message: string) => store.add('warning', message),
	info: (message: string) => store.add('info', message),
	destructive: (message: string) => store.add('destructive', message),
	dismiss: store.dismiss,
	clear: store.clear
}
