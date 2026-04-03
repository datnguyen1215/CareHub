/**
 * Shared WebSocket utilities for URL building and reconnection strategy.
 * Framework-agnostic: used by both Portal and Kiosk.
 */

/**
 * Builds a WebSocket URL using the current page's protocol and host.
 * @param params - Query parameters to append to the URL
 * @returns WebSocket URL (ws: or wss: depending on page protocol)
 */
export function buildWsUrl(params: Record<string, string>): string {
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	const host = window.location.host
	const query = new URLSearchParams(params).toString()
	return `${protocol}//${host}/ws?${query}`
}

/**
 * Parses a WebSocket message from raw string data.
 * @param data - Raw message string from WebSocket
 * @returns Parsed object, or null if parsing fails
 */
export function parseMessage<T = unknown>(data: string): T | null {
	try {
		return JSON.parse(data) as T
	} catch {
		console.error('[WebSocket] Failed to parse message:', data)
		return null
	}
}

/** Options for reconnection strategy */
export interface ReconnectOptions {
	/** Initial delay in milliseconds (default: 1000) */
	initialDelayMs?: number
	/** Maximum delay in milliseconds (default: 30000) */
	maxDelayMs?: number
	/** Backoff multiplier (default: 2) */
	multiplier?: number
}

/** Reconnection strategy controller */
export interface ReconnectStrategy {
	/** Get delay before next reconnect attempt */
	getDelay: (attempt: number) => number
}

/**
 * Creates an exponential backoff reconnection strategy.
 * @param options - Configuration for backoff behavior
 * @returns ReconnectStrategy with getDelay method
 */
export function createReconnectStrategy(options: ReconnectOptions = {}): ReconnectStrategy {
	const {
		initialDelayMs = 1000,
		maxDelayMs = 30000,
		multiplier = 2
	} = options

	return {
		getDelay(attempt: number): number {
			const delay = initialDelayMs * Math.pow(multiplier, attempt)
			return Math.min(delay, maxDelayMs)
		}
	}
}

/**
 * Creates a fixed-delay reconnection strategy (for kiosk).
 * @param delayMs - Fixed delay between reconnect attempts (default: 3000)
 * @returns ReconnectStrategy with getDelay method
 */
export function createFixedReconnectStrategy(delayMs = 3000): ReconnectStrategy {
	return {
		getDelay(): number {
			return delayMs
		}
	}
}
