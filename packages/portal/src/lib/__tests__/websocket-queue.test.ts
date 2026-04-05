import { describe, it, expect, vi, beforeEach } from 'vitest';
import { send, disconnect, getPendingMessageCount } from '$lib/services/websocket';

// Mock @carehub/shared to avoid pulling in state machine code that requires xstate
vi.mock('@carehub/shared', () => ({
	buildWsUrl: vi.fn(() => 'ws://localhost:3000/ws'),
	createReconnectStrategy: vi.fn(() => ({
		getDelay: vi.fn(() => 1000),
		reset: vi.fn()
	})),
	parseMessage: vi.fn()
}));

/** Create a signaling message with a given type */
function makeMessage(type: string) {
	return { type, callId: 'test-call-1' } as any;
}

describe('WebSocket message queue priority', () => {
	beforeEach(() => {
		// Clear module state by disconnecting
		disconnect();
	});

	it('queues messages when WebSocket is not connected', () => {
		expect(getPendingMessageCount()).toBe(0);

		send(makeMessage('call:initiate'));
		send(makeMessage('call:ringing'));

		expect(getPendingMessageCount()).toBe(2);
	});

	it('preserves critical SDP offer over low-priority screen-share message', () => {
		// Fill queue with low-priority screen-share messages first
		for (let i = 0; i < 49; i++) {
			send(makeMessage('call:screen-share'));
		}
		expect(getPendingMessageCount()).toBe(49);

		// Add one more screen-share to reach capacity — should succeed (50th slot)
		send(makeMessage('call:screen-share'));
		expect(getPendingMessageCount()).toBe(50);

		// Now send a critical SDP offer — should evict a screen-share message
		send(makeMessage('call:offer'));

		// Queue stays at MAX_QUEUE_SIZE (50) — one evicted, one added
		expect(getPendingMessageCount()).toBe(50);
	});

	it('preserves critical ICE candidate over low-priority error message', () => {
		// Fill queue with error messages
		for (let i = 0; i < 50; i++) {
			send(makeMessage('call:error'));
		}
		expect(getPendingMessageCount()).toBe(50);

		// Send critical ICE candidate — should evict an error message
		send(makeMessage('call:ice-candidate'));
		expect(getPendingMessageCount()).toBe(50);
	});

	it('drops incoming low-priority message when queue is full of same priority', () => {
		// Fill queue entirely with screen-share messages (priority 0)
		for (let i = 0; i < 50; i++) {
			send(makeMessage('call:screen-share'));
		}
		expect(getPendingMessageCount()).toBe(50);

		// Send another screen-share — all queued have same priority,
		// incoming is not higher, so it gets dropped
		send(makeMessage('call:screen-share'));

		// Queue should remain at 50 — incoming was dropped
		expect(getPendingMessageCount()).toBe(50);
	});

	it('drops incoming normal-priority message when queue is full of normal+critical', () => {
		// Fill half with critical, half with normal
		for (let i = 0; i < 25; i++) {
			send(makeMessage('call:offer'));
		}
		for (let i = 0; i < 25; i++) {
			send(makeMessage('call:initiate'));
		}
		expect(getPendingMessageCount()).toBe(50);

		// Send a screen-share — lowest in queue is normal (priority 1),
		// but incoming is priority 0 which is <= 1, so incoming is dropped
		send(makeMessage('call:screen-share'));
		expect(getPendingMessageCount()).toBe(50);
	});

	it('evicts low-priority message when normal-priority message arrives at capacity', () => {
		// Fill with all low-priority
		for (let i = 0; i < 50; i++) {
			send(makeMessage('call:error'));
		}
		expect(getPendingMessageCount()).toBe(50);

		// Send normal-priority initiate — should evict an error (priority 0)
		send(makeMessage('call:initiate'));
		expect(getPendingMessageCount()).toBe(50);
	});

	it('handles rapid SDP offer/answer/ICE under queue pressure', () => {
		// Simulate realistic scenario: queue fills during reconnect,
		// then critical signaling arrives

		// Fill 45 slots with mixed messages
		for (let i = 0; i < 15; i++) {
			send(makeMessage('call:initiate'));
			send(makeMessage('call:screen-share'));
			send(makeMessage('call:ringing'));
		}
		expect(getPendingMessageCount()).toBe(45);

		// Now simulate a burst of critical signaling
		send(makeMessage('call:offer'));
		send(makeMessage('call:answer'));
		send(makeMessage('call:ice-candidate'));
		send(makeMessage('call:offer'));
		send(makeMessage('call:answer'));

		// All critical messages should have been queued (evicting lower-priority ones)
		expect(getPendingMessageCount()).toBe(50);
	});

	it('clears queue on disconnect', () => {
		send(makeMessage('call:initiate'));
		send(makeMessage('call:ringing'));
		expect(getPendingMessageCount()).toBe(2);

		disconnect();
		expect(getPendingMessageCount()).toBe(0);
	});
});
