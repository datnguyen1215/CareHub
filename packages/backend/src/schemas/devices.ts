import { z } from 'zod'

export const updateDeviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(100, 'name must be at most 100 characters'),
})

export const assignProfilesSchema = z.object({
  profileIds: z
    .array(z.string().uuid('each profileId must be a valid UUID'))
    .min(1, 'profileIds array is required')
    .max(50, 'profileIds must have at most 50 items'),
})

export const pairDeviceSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Pairing token is required'),
  profileIds: z
    .array(z.string().uuid('each profileId must be a valid UUID'))
    .max(50, 'profileIds must have at most 50 items')
    .optional(),
})
