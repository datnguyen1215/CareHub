import { z } from 'zod'

const VALID_CATEGORIES = [
  'lab_result',
  'prescription',
  'insurance',
  'billing',
  'imaging',
  'other',
] as const

export const createAttachmentSchema = z
  .object({
    category: z.enum(VALID_CATEGORIES, {
      message: `category is required and must be one of: ${VALID_CATEGORIES.join(', ')}`,
    }),
    description: z
      .string()
      .max(2000, 'description must be at most 2000 characters')
      .nullable()
      .optional(),
    event_id: z.string().uuid('event_id must be a valid UUID').nullable().optional(),
    journal_id: z.string().uuid('journal_id must be a valid UUID').nullable().optional(),
  })
  .refine(
    (data) =>
      (data.event_id && !data.journal_id) || (!data.event_id && data.journal_id),
    { message: 'Exactly one of event_id or journal_id must be provided' }
  )

export const updateAttachmentSchema = z.object({
  description: z
    .string()
    .max(2000, 'description must be at most 2000 characters')
    .nullable()
    .optional(),
  category: z.enum(VALID_CATEGORIES, {
    message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
  }).optional(),
})
