/** POST /api/auth/verify-otp — validates OTP, creates/retrieves user, sets auth cookie. */
import { json } from '@sveltejs/kit';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { signToken } from '$lib/server/auth';
import { otps, users } from '@carehub/shared';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const { email, code } = body as { email?: string; code?: string };

		if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
			return json({ error: 'email and code are required' }, { status: 400 });
		}

		const now = new Date();
		const [otp] = await db
			.select()
			.from(otps)
			.where(and(eq(otps.email, email), eq(otps.code, code), gt(otps.expires_at, now)))
			.limit(1);

		if (!otp) {
			return json({ error: 'Invalid or expired OTP' }, { status: 401 });
		}

		// Delete used OTP and upsert user in a transaction
		const { user, isNewUser } = await db.transaction(async (tx) => {
			await tx.delete(otps).where(eq(otps.email, email));

			let [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
			const isNew = !existing;
			if (isNew) {
				const [created] = await tx.insert(users).values({ email }).returning();
				existing = created;
			}

			return { user: existing, isNewUser: isNew };
		});

		const token = signToken({ userId: user.id, email: user.email });

		cookies.set('token', token, {
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			path: '/'
		});

		return json({ isNewUser });
	} catch (err) {
		console.error('verify-otp error:', err);
		return json({ error: 'Verification failed' }, { status: 500 });
	}
};
