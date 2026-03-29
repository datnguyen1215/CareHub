/** Email service — Nodemailer transport for sending OTP emails. */
import nodemailer, { type Transporter } from 'nodemailer';

let _transport: Transporter | null = null;

/**
 * Get the nodemailer transport instance.
 * Uses lazy initialization to avoid creating SMTP connection at module load time.
 * This prevents startup crashes and build errors when SMTP credentials are missing.
 */
function getTransport(): Transporter {
	if (!_transport) {
		_transport = nodemailer.createTransport({
			host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
			port: parseInt(process.env.SMTP_PORT ?? '587', 10),
			secure: false,
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS
			}
		});
	}
	return _transport;
}

/**
 * Sends an OTP code to the given email address.
 * @param {string} to - Recipient email address
 * @param {string} code - OTP code
 * @returns {Promise<void>}
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
	const fromName = process.env.SMTP_FROM_NAME ?? 'CareHub';
	const fromAddress = process.env.SMTP_USER ?? 'noreply@carehub.local';

	await getTransport().sendMail({
		from: `"${fromName}" <${fromAddress}>`,
		to,
		subject: 'Your CareHub login code',
		text: `Your CareHub code is: ${code}. It expires in 15 minutes.`,
		html: `<p>Your CareHub code is: <strong>${code}</strong>. It expires in 15 minutes.</p>`
	});
}
