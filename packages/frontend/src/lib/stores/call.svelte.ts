/**
 * Reactive call state store using Svelte 5 runes.
 * Manages call lifecycle: idle → calling → connected → ended.
 */

export type CallStatus = 'idle' | 'calling' | 'connected' | 'ended';

interface CallState {
	status: CallStatus;
	deviceId: string | null;
	deviceName: string | null;
	muted: boolean;
	videoEnabled: boolean;
}

const initial: CallState = {
	status: 'idle',
	deviceId: null,
	deviceName: null,
	muted: false,
	videoEnabled: false
};

function createCallStore() {
	let state = $state<CallState>({ ...initial });

	return {
		get status() {
			return state.status;
		},
		get deviceId() {
			return state.deviceId;
		},
		get deviceName() {
			return state.deviceName;
		},
		get muted() {
			return state.muted;
		},
		get videoEnabled() {
			return state.videoEnabled;
		},
		get callState() {
			return state;
		},

		initiateCall(deviceId: string, deviceName: string) {
			state = {
				status: 'calling',
				deviceId,
				deviceName,
				muted: false,
				videoEnabled: false
			};
		},

		/**
		 * Simulate the call connecting after initiation.
		 * Replace with real WebRTC logic when available.
		 */
		connect() {
			if (state.status === 'calling') {
				state.status = 'connected';
			}
		},

		endCall() {
			state = { ...initial, status: 'ended' };
			// Reset to idle after a brief period so the modal can animate out
			setTimeout(() => {
				if (state.status === 'ended') {
					state = { ...initial };
				}
			}, 1500);
		},

		toggleMute() {
			if (state.status === 'connected') {
				state = { ...state, muted: !state.muted };
			}
		},

		toggleVideo() {
			if (state.status === 'connected') {
				state = { ...state, videoEnabled: !state.videoEnabled };
			}
		}
	};
}

export const callStore = createCallStore();
