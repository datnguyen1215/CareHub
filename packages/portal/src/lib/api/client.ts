/**
 * Shared API client utilities.
 */

export interface ApiError {
	message: string;
	status: number;
}

/**
 * Type guard to check if an error is an ApiError.
 */
export function isApiError(err: unknown): err is ApiError {
	return typeof err === 'object' && err !== null && 'status' in err && 'message' in err;
}

/**
 * Builds a query string from a record of string parameters.
 * Undefined values are omitted.
 */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) searchParams.set(key, String(value));
	}
	const qs = searchParams.toString();
	return qs ? `?${qs}` : '';
}

/**
 * Core request helper for JSON API calls.
 */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(`/api${path}`, {
		method,
		headers: body ? { 'Content-Type': 'application/json' } : {},
		body: body ? JSON.stringify(body) : undefined,
		credentials: 'include'
	});

	if (!res.ok) {
		let message = `Request failed (${res.status})`;
		try {
			const data = await res.json();
			if (data?.message) message = data.message;
			else if (data?.error) message = data.error;
		} catch {
			// ignore parse errors
		}
		const err: ApiError = { message, status: res.status };
		throw err;
	}

	// 204 No Content
	if (res.status === 204) return undefined as T;

	return res.json() as Promise<T>;
}
