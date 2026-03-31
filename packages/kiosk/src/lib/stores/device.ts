/** Device state store. */
import type { Profile, Caretaker } from '$lib/services/api';

/** Device state */
export interface DeviceState {
	deviceId: string | null;
	name: string | null;
	isPaired: boolean;
	isLoading: boolean;
	profiles: Profile[];
	caretakers: Caretaker[];
	error: string | null;
}

/** Initial device state */
export const initialDeviceState: DeviceState = {
	deviceId: null,
	name: null,
	isPaired: false,
	isLoading: true,
	profiles: [],
	caretakers: [],
	error: null
};
