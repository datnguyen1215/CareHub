import { z } from 'zod'

const isoDateString = z
  .string()
  .min(1, 'valid entry_date is required')
  .refine((val) => !isNaN(Date.parse(val)), 'valid entry_date is required')

export const createJournalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'title is required')
    .max(200, 'title must be at most 200 characters'),
  content: z
    .string()
    .trim()
    .min(1, 'content is required')
    .max(50000, 'content must be at most 50000 characters'),
  key_takeaways: z
    .string()
    .max(5000, 'key_takeaways must be at most 5000 characters')
    .nullable()
    .optional(),
  entry_date: isoDateString,
  linked_event_id: z
    .string()
    .uuid('linked_event_id must be a valid UUID')
    .nullable()
    .optional(),
  starred: z.boolean().optional(),
})

export const updateJournalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'title cannot be empty')
    .max(200, 'title must be at most 200 characters')
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, 'content cannot be empty')
    .max(50000, 'content must be at most 50000 characters')
    .optional(),
  key_takeaways: z
    .string()
    .max(5000, 'key_takeaways must be at most 5000 characters')
    .nullable()
    .optional(),
  entry_date: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Date.parse(val)), 'invalid entry_date')
    .optional(),
  linked_event_id: z
    .string()
    .uuid('linked_event_id must be a valid UUID')
    .nullable()
    .optional(),
  starred: z.boolean().optional(),
})
