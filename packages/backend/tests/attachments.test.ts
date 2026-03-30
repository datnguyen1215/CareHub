import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { makeAuthCookie } from './utils'
import { truncateAll } from './helpers/truncate'
import {
  createUser,
  createProfile,
  createEvent,
  createJournalEntry,
  createAttachment,
} from './factories'
import { db } from '../src/db'
import { attachments } from '@carehub/shared'
import { eq } from 'drizzle-orm'

const app = createApp()

beforeAll(async () => {
  await truncateAll()
})

describe('POST /api/profiles/:profileId/attachments', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/profiles/profile-1/attachments')
      .field('category', 'other')
      .attach('file', Buffer.from('test'), 'test.jpg')
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file is provided', async () => {
    const user = await createUser({ email: 'attach-no-file@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'other')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('No file provided')
  })

  it('returns 400 when category is missing', async () => {
    const user = await createUser({ email: 'attach-no-category@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .attach('file', Buffer.from('test'), 'test.jpg')

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('category is required')
  })

  it('returns 400 when neither event_id nor journal_id is provided', async () => {
    const user = await createUser({ email: 'attach-no-parent@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'other')
      .attach('file', Buffer.from('test'), 'test.jpg')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Exactly one of event_id or journal_id must be provided')
  })

  it('returns 400 when both event_id and journal_id are provided', async () => {
    const user = await createUser({ email: 'attach-both-parents@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Doctor Visit',
      event_type: 'doctor_visit',
      event_date: new Date(),
    })
    const journal = await createJournalEntry({
      care_profile_id: profile.id,
      title: 'Visit Notes',
      content: 'Notes from the visit',
      entry_date: '2024-01-15',
    })

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'other')
      .field('event_id', event.id)
      .field('journal_id', journal.id)
      .attach('file', Buffer.from('test'), 'test.jpg')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Exactly one of event_id or journal_id must be provided')
  })

  it('creates attachment linked to event', async () => {
    const user = await createUser({ email: 'attach-event@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Lab Work',
      event_type: 'lab_work',
      event_date: new Date(),
    })

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'lab_result')
      .field('event_id', event.id)
      .field('description', 'Blood test results')
      .attach('file', Buffer.from('test file content'), 'results.pdf')

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.profile_id).toBe(profile.id)
    expect(res.body.event_id).toBe(event.id)
    expect(res.body.journal_id).toBeNull()
    expect(res.body.category).toBe('lab_result')
    expect(res.body.description).toBe('Blood test results')
    expect(res.body.file_url).toContain('/uploads/')

    // Verify in database
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, res.body.id))
    expect(attachment).toBeDefined()
    expect(attachment.event_id).toBe(event.id)
  })

  it('creates attachment linked to journal entry', async () => {
    const user = await createUser({ email: 'attach-journal@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const journal = await createJournalEntry({
      care_profile_id: profile.id,
      title: 'Medical Notes',
      content: 'Notes about prescription',
      entry_date: '2024-01-20',
    })

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'prescription')
      .field('journal_id', journal.id)
      .attach('file', Buffer.from('prescription image'), 'prescription.jpg')

    expect(res.status).toBe(201)
    expect(res.body.journal_id).toBe(journal.id)
    expect(res.body.event_id).toBeNull()
    expect(res.body.category).toBe('prescription')
  })

  it('returns 400 for invalid event_id', async () => {
    const user = await createUser({ email: 'attach-invalid-event@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const fakeUuid = '00000000-0000-0000-0000-000000000000'

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'other')
      .field('event_id', fakeUuid)
      .attach('file', Buffer.from('test'), 'test.jpg')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid event_id')
  })

  it('returns 400 for invalid journal_id', async () => {
    const user = await createUser({ email: 'attach-invalid-journal@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const fakeUuid = '00000000-0000-0000-0000-000000000000'

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'other')
      .field('journal_id', fakeUuid)
      .attach('file', Buffer.from('test'), 'test.jpg')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid journal_id')
  })

  it('returns 403 for non-owner (no access)', async () => {
    const user = await createUser({ email: 'attach-non-owner@example.com' })
    const otherUser = await createUser({ email: 'attach-owner@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })

    const res = await request(app)
      .post(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .field('category', 'other')
      .field('event_id', event.id)
      .attach('file', Buffer.from('test'), 'test.jpg')

    expect(res.status).toBe(403)
  })
})

describe('GET /api/profiles/:profileId/attachments', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/profiles/profile-1/attachments')
    expect(res.status).toBe(401)
  })

  it('returns list of attachments for profile', async () => {
    const user = await createUser({ email: 'list-attach@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })

    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/test1.pdf',
      category: 'lab_result',
    })
    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/test2.pdf',
      category: 'prescription',
    })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('filters by event_id', async () => {
    const user = await createUser({ email: 'filter-event@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event1 = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit 1',
      event_type: 'general',
      event_date: new Date(),
    })
    const event2 = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit 2',
      event_type: 'general',
      event_date: new Date(),
    })

    await createAttachment({
      profile_id: profile.id,
      event_id: event1.id,
      file_url: '/uploads/e1.pdf',
      category: 'other',
    })
    await createAttachment({
      profile_id: profile.id,
      event_id: event2.id,
      file_url: '/uploads/e2.pdf',
      category: 'other',
    })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments?event_id=${event1.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].event_id).toBe(event1.id)
  })

  it('filters by journal_id', async () => {
    const user = await createUser({ email: 'filter-journal@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const journal = await createJournalEntry({
      care_profile_id: profile.id,
      title: 'Notes',
      content: 'Content',
      entry_date: '2024-01-15',
    })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })

    await createAttachment({
      profile_id: profile.id,
      journal_id: journal.id,
      file_url: '/uploads/j1.pdf',
      category: 'other',
    })
    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/e1.pdf',
      category: 'other',
    })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments?journal_id=${journal.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].journal_id).toBe(journal.id)
  })

  it('filters by category', async () => {
    const user = await createUser({ email: 'filter-category@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })

    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/lab.pdf',
      category: 'lab_result',
    })
    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/rx.pdf',
      category: 'prescription',
    })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments?category=lab_result`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].category).toBe('lab_result')
  })

  it('respects limit parameter', async () => {
    const user = await createUser({ email: 'limit-attach@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })

    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/1.pdf',
      category: 'other',
    })
    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/2.pdf',
      category: 'other',
    })
    await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/3.pdf',
      category: 'other',
    })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments?limit=2`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('returns 403 for non-owner (no access)', async () => {
    const user = await createUser({ email: 'list-non-owner@example.com' })
    const otherUser = await createUser({ email: 'list-owner@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Rose' })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })
})

describe('GET /api/profiles/:profileId/attachments/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/profiles/profile-1/attachments/attach-1')
    expect(res.status).toBe(401)
  })

  it('returns a single attachment', async () => {
    const user = await createUser({ email: 'get-single@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/single.pdf',
      category: 'insurance',
      description: 'Insurance card',
    })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(attachment.id)
    expect(res.body.description).toBe('Insurance card')
  })

  it('returns 404 when attachment not found', async () => {
    const user = await createUser({ email: 'get-not-found@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const fakeUuid = '00000000-0000-0000-0000-000000000000'

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('returns 403 for non-owner (no access)', async () => {
    const user = await createUser({ email: 'get-non-owner@example.com' })
    const otherUser = await createUser({ email: 'get-owner@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/private.pdf',
      category: 'other',
    })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/profiles/:profileId/attachments/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/profiles/profile-1/attachments/attach-1')
      .send({ description: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('updates description', async () => {
    const user = await createUser({ email: 'patch-desc@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/update.pdf',
      category: 'other',
    })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ description: 'New description' })

    expect(res.status).toBe(200)
    expect(res.body.description).toBe('New description')

    // Verify in database
    const [updated] = await db.select().from(attachments).where(eq(attachments.id, attachment.id))
    expect(updated.description).toBe('New description')
  })

  it('updates category', async () => {
    const user = await createUser({ email: 'patch-category@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/cat.pdf',
      category: 'other',
    })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ category: 'billing' })

    expect(res.status).toBe(200)
    expect(res.body.category).toBe('billing')
  })

  it('returns 400 for invalid category', async () => {
    const user = await createUser({ email: 'patch-invalid-cat@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/inv.pdf',
      category: 'other',
    })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ category: 'invalid_category' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('category must be one of')
  })

  it('returns 404 when attachment not found', async () => {
    const user = await createUser({ email: 'patch-not-found@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const fakeUuid = '00000000-0000-0000-0000-000000000000'

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}/attachments/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ description: 'Updated' })

    expect(res.status).toBe(404)
  })

  it('returns 403 for non-owner (no access)', async () => {
    const user = await createUser({ email: 'patch-non-owner@example.com' })
    const otherUser = await createUser({ email: 'patch-owner@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/no-access.pdf',
      category: 'other',
    })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ description: 'Hacked' })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/profiles/:profileId/attachments/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/profiles/profile-1/attachments/attach-1')
    expect(res.status).toBe(401)
  })

  it('deletes an attachment and returns 204', async () => {
    const user = await createUser({ email: 'delete-attach@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/delete-me.pdf',
      category: 'other',
    })

    const res = await request(app)
      .delete(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(204)

    // Verify deletion in database
    const [deleted] = await db.select().from(attachments).where(eq(attachments.id, attachment.id))
    expect(deleted).toBeUndefined()
  })

  it('returns 404 when attachment not found', async () => {
    const user = await createUser({ email: 'delete-not-found@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })
    const fakeUuid = '00000000-0000-0000-0000-000000000000'

    const res = await request(app)
      .delete(`/api/profiles/${profile.id}/attachments/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('returns 403 for non-owner (no access)', async () => {
    const user = await createUser({ email: 'delete-non-owner@example.com' })
    const otherUser = await createUser({ email: 'delete-owner@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Rose' })
    const event = await createEvent({
      care_profile_id: profile.id,
      title: 'Visit',
      event_type: 'general',
      event_date: new Date(),
    })
    const attachment = await createAttachment({
      profile_id: profile.id,
      event_id: event.id,
      file_url: '/uploads/private-delete.pdf',
      category: 'other',
    })

    const res = await request(app)
      .delete(`/api/profiles/${profile.id}/attachments/${attachment.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })
})
