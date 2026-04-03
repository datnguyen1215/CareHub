/**
 * Standard debounce utility. Framework-agnostic (no Svelte imports).
 *
 * Usage:
 * ```ts
 * const debouncedSearch = debounce(() => { ... }, 300);
 * debouncedSearch();
 * // Later, for cleanup:
 * debouncedSearch.cancel();
 * ```
 */

type AnyFn = (...args: any[]) => void;

export interface DebouncedFn<T extends AnyFn> {
	(...args: Parameters<T>): void;
	/** Cancel any pending execution */
	cancel: () => void;
}

/**
 * Returns a debounced version of `fn` that delays invocation by `delay` ms.
 * The returned function has a `.cancel()` method for cleanup.
 */
export function debounce<T extends AnyFn>(fn: T, delay: number): DebouncedFn<T> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	function debounced(this: unknown, ...args: Parameters<T>) {
		if (timeoutId !== null) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			timeoutId = null;
			fn.apply(this, args);
		}, delay);
	}

	(debounced as DebouncedFn<T>).cancel = () => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	return debounced as DebouncedFn<T>;
}
