import { z } from 'zod'

export const createProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(200, 'name must be at most 200 characters'),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_of_birth must be a valid ISO date (YYYY-MM-DD)')
    .optional(),
  relationship: z
    .string()
    .max(100, 'relationship must be at most 100 characters')
    .nullable()
    .optional(),
  conditions: z
    .array(z.string().max(200, 'each condition must be at most 200 characters'))
    .max(50, 'conditions must have at most 50 items')
    .optional(),
  avatar_url: z
    .string()
    .url('avatar_url must be a valid URL')
    .max(2048, 'avatar_url must be at most 2048 characters')
    .nullable()
    .optional(),
})

export const updateProfileSchema = createProfileSchema.partial().extend({
  name: z
    .string()
    .trim()
    .min(1, 'name cannot be empty')
    .max(200, 'name must be at most 200 characters')
    .optional(),
  date_of_birth: z
    .union([
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_of_birth must be a valid ISO date (YYYY-MM-DD)'),
      z.literal(''),
      z.null(),
    ])
    .optional(),
  relationship: z.union([
    z.string().max(100, 'relationship must be at most 100 characters'),
    z.null(),
  ]).optional(),
  avatar_url: z.union([
    z.string().url('avatar_url must be a valid URL').max(2048, 'avatar_url must be at most 2048 characters'),
    z.null(),
  ]).optional(),
  conditions: z
    .array(z.string().max(200, 'each condition must be at most 200 characters'))
    .max(50, 'conditions must have at most 50 items')
    .optional(),
})
