import { z } from 'zod'

const VALID_SCHEDULE = ['morning', 'afternoon', 'evening', 'bedtime'] as const

export const createMedicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(200, 'name must be at most 200 characters'),
  dosage: z
    .string()
    .max(200, 'dosage must be at most 200 characters')
    .nullable()
    .optional(),
  schedule: z
    .array(z.enum(VALID_SCHEDULE))
    .max(20, 'schedule must have at most 20 items')
    .optional(),
  status: z.enum(['active', 'discontinued']).optional(),
})

export const updateMedicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name cannot be empty')
    .max(200, 'name must be at most 200 characters')
    .optional(),
  dosage: z
    .string()
    .max(200, 'dosage must be at most 200 characters')
    .nullable()
    .optional(),
  schedule: z
    .array(z.enum(VALID_SCHEDULE))
    .max(20, 'schedule must have at most 20 items')
    .optional(),
  status: z.enum(['active', 'discontinued']).optional(),
})
