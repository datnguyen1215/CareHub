import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const fromName = process.env.SMTP_FROM_NAME ?? 'CareHub'
  const fromAddress = process.env.SMTP_USER ?? 'noreply@carehub.local'
  const transport = createTransport()

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject: 'Your CareHub login code',
    text: `Your CareHub code is: ${code}. It expires in 15 minutes.`,
    html: `<p>Your CareHub code is: <strong>${code}</strong>. It expires in 15 minutes.</p>`,
  })
}
