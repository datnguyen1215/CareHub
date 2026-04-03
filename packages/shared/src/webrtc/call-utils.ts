/**
 * Shared call utility helpers used by both Portal and Kiosk call stores.
 * Framework-agnostic: returns plain objects/functions, not reactive primitives.
 */

import type { CallContext } from './call-state-machine.js'

/**
 * Creates a duration timer for tracking call length.
 * Returns start/stop/getSeconds functions for lifecycle control.
 *
 * @param onTick - Optional callback invoked each second with current duration
 * @returns Timer control object
 */
export function createDurationTimer(
	onTick?: (seconds: number) => void
): { start: (startedAt: Date) => void; stop: () => void; getSeconds: () => number } {
	let intervalId: ReturnType<typeof setInterval> | null = null
	let startedAt: Date | null = null

	function getSeconds(): number {
		if (!startedAt) return 0
		return Math.floor((Date.now() - startedAt.getTime()) / 1000)
	}

	function start(startTime: Date): void {
		stop()
		startedAt = startTime
		intervalId = setInterval(() => {
			onTick?.(getSeconds())
		}, 1000)
	}

	function stop(): void {
		if (intervalId) {
			clearInterval(intervalId)
			intervalId = null
		}
		startedAt = null
	}

	return { start, stop, getSeconds }
}

/**
 * Maps a hierarchical state machine state string to its top-level component.
 * E.g., "signaling.waitingForAccept" -> "signaling"
 */
export function getTopLevelState(machineState: string): string {
	return machineState.split('.')[0]
}
