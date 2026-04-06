/**
 * User API functions and types.
 */

import { request } from './client';

export interface MeResponse {
	id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
}

export function getMe() {
	return request<MeResponse>('GET', '/users/me');
}

export function updateMe(data: { first_name: string; last_name: string }) {
	return request<MeResponse>('PATCH', '/users/me', data);
}
