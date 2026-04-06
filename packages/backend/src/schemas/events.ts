import { z } from 'zod'

const VALID_EVENT_TYPES = ['doctor_visit', 'lab_work', 'therapy', 'general'] as const

const isoDateString = z
  .string()
  .min(1, 'valid event_date is required')
  .refine((val) => !isNaN(Date.parse(val)), 'valid event_date is required')

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'title is required')
    .max(200, 'title must be at most 200 characters'),
  event_type: z.enum(VALID_EVENT_TYPES, {
    message: 'valid event_type is required',
  }),
  event_date: isoDateString,
  location: z
    .string()
    .max(500, 'location must be at most 500 characters')
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(5000, 'notes must be at most 5000 characters')
    .nullable()
    .optional(),
})

export const updateEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'title cannot be empty')
    .max(200, 'title must be at most 200 characters')
    .optional(),
  event_type: z.enum(VALID_EVENT_TYPES, {
    message: 'invalid event_type',
  }).optional(),
  event_date: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Date.parse(val)), 'invalid event_date')
    .optional(),
  location: z
    .string()
    .max(500, 'location must be at most 500 characters')
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(5000, 'notes must be at most 5000 characters')
    .nullable()
    .optional(),
})
