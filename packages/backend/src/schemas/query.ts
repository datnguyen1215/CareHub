import { z } from 'zod'

export const paginationSchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, 'limit must be a positive integer')
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, 'limit must be between 1 and 100')
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/, 'offset must be a non-negative integer')
    .transform(Number)
    .refine((n) => n >= 0, 'offset must be a non-negative integer')
    .optional(),
})
