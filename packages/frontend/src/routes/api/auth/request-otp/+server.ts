/** POST /api/auth/request-otp — sends OTP email with rate limiting. */
import { json } from '@sveltejs/kit';
import { eq, max } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '$lib/server/db';
import { sendOtpEmail } from '$lib/server/email';
import { otps } from '@carehub/shared';
import type { RequestHandler } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generates a cryptographically random 6-digit OTP.
 * @returns {string} 6-digit OTP string
 */
const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { email } = body as { email?: string };

		if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
			return json({ error: 'A valid email is required' }, { status: 400 });
		}

		// Enforce 60-second cooldown between OTP requests for the same email
		const [{ lastSent }] = await db
			.select({ lastSent: max(otps.created_at) })
			.from(otps)
			.where(eq(otps.email, email));

		if (lastSent) {
			const secondsElapsed = (Date.now() - new Date(lastSent).getTime()) / 1000;
			const retryAfter = Math.ceil(60 - secondsElapsed);
			if (retryAfter > 0) {
				return json(
					{ error: 'Please wait before requesting another OTP', retryAfter },
					{ status: 429 }
				);
			}
		}

		const code = generateOtp();
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

		await sendOtpEmail(email, code);
		await db.insert(otps).values({ email, code, expires_at: expiresAt });

		return json({ message: 'OTP sent' });
	} catch (err) {
		console.error('request-otp error:', err);
		return json({ error: 'Failed to send OTP' }, { status: 500 });
	}
};
