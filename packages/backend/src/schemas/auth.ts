import { z } from 'zod'

export const requestOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'A valid email is required')
    .email('A valid email is required'),
})

export const verifyOtpSchema = z.object({
  email: z.string().trim().min(1, 'email and code are required'),
  code: z.string().min(1, 'email and code are required'),
})
