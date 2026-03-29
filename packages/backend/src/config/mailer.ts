import nodemailer from 'nodemailer'
import { env } from './env.js'

/**
 * Nodemailer transporter configured for Gmail SMTP.
 * Set SMTP_USER and SMTP_PASSWORD (app password) in environment.
 */
export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
})

/**
 * Sends an email using the configured transporter.
 */
export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  return mailer.sendMail({
    from: env.SMTP_FROM,
    ...opts,
  })
}
