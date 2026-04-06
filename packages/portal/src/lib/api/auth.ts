/**
 * Authentication API functions.
 */

import { request } from './client';

export function requestOtp(email: string) {
	return request<void>('POST', '/auth/request-otp', { email });
}

export function verifyOtp(email: string, code: string) {
	return request<void>('POST', '/auth/verify-otp', { email, code });
}

export function logout() {
	return request<void>('POST', '/auth/logout');
}

/** Gets a short-lived ticket for WebSocket authentication */
export function getWsTicket() {
	return request<{ ticket: string }>('GET', '/auth/ws-ticket');
}
