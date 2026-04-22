# CareHub Roadmap

Project milestones and progress tracking for CareHub healthcare management platform.

> For detailed feature specifications, see [docs/phases.md](docs/phases.md) and [docs/features.md](docs/features.md).

---

## Current Status

**Phase 2: Calendar and Documents** — 🚧 Deferred
Journal entries, attachments, OCR, and documents search complete. Calendar view and event CRUD still outstanding.

**Phase 3: Tablet and Communication** — 🚧 In Progress

- ✅ Phase 3.0: Kiosk Foundation (device management, pairing, kiosk UI)
- ✅ Phase 3.5: Video Calling (WebRTC calling, screen share, call state machine)
- 🚧 Phase 3.6: Capacitor Native Apps (APKs shipping, OTA in place; FCM/foreground service remaining)

---

## ✅ Phase 1: Foundation (MVP) — Complete

Established authentication, core data structures, and basic health tracking.

- [x] Auth system (Email + OTP via Nodemailer, JWT in httpOnly cookies)
- [x] Monorepo setup (npm workspaces: portal, backend, shared, kiosk)
- [x] Database (PostgreSQL + Docker + Drizzle ORM)
- [x] Group creation (onboarding flow)
- [x] Care profile CRUD (name, photo, relationship, DOB, conditions)
- [x] Medication management (add/edit/remove with schedule and status tracking)
- [x] Home dashboard (card grid with profile summaries)
- [x] Profile detail view (Overview and Medications tabs)
- [x] Deployment (Docker Compose + Traefik + Let's Encrypt SSL)
- [x] Mobile-responsive layout (bottom navigation, card-based UI)

**Screens**: Login, Home Dashboard, Profile Detail, Medications

---

## 🚧 Phase 2: Calendar and Documents — Deferred

Add scheduling, journaling, and AI-powered document management. Journaling and documents shipped; calendar deferred while Phase 3 work took priority.

### Key Deliverables

- [ ] Calendar view (monthly calendar with event dots and list view)
- [ ] Event CRUD (appointments with type, date, location, notes)
- [x] Journal entries (free-form text linked to dates and events)
- [x] Key takeaways (summary field on journal entries)
- [x] Attachment upload (camera capture and file upload for journal and event attachments)
- [x] OCR text extraction (Google Vision API integration)
- [x] Attachment categorization (auto-categorize: lab results, prescriptions, insurance, billing, imaging)
- [x] Full-text search (PostgreSQL full-text search across OCR text)
- [x] Documents tab (search/browse view across all profile attachments)

**Screens**: Calendar, Journal Entry, Documents, Attachment Detail

---

## 🚧 Phase 3: Tablet and Communication — In Progress

Enable tablet kiosk experience and real-time communication.

### Phase 3.0: Kiosk Foundation — ✅ Complete

- [x] Database schema (devices, device_care_profiles, device_access, device_pairing_tokens)
- [x] Migrations (0007_devices.sql)
- [x] Device API endpoints (12 endpoints: register, validate, pair, manage)
- [x] Device authentication middleware (deviceAuth with device_token)
- [x] WebSocket server (mounted on /ws with device token auth)
- [x] WebSocket events (device_paired, device_revoked, profiles_updated, heartbeat)
- [x] Kiosk package (packages/kiosk SvelteKit app on port 9393)
- [x] Kiosk pairing screen (QR display with auto-refresh)
- [x] Kiosk home screen (profile card grid for multi-profile devices)
- [x] Kiosk profile dashboard (greeting, caretaker cards, appointments)
- [x] Kiosk design system (80px touch targets, 20px base font, high contrast)
- [x] Connection management (auto-reconnect, online/offline indicator)
- [x] Portal device management (list, pair, assign profiles, rename, unpair)
- [x] Remote unpair (device_revoked event clears kiosk data)

### Phase 3.5: Video Calling — ✅ Complete

- [x] WebRTC video calling (caretaker-to-tablet and tablet-to-caretaker)
- [x] Incoming call screen on tablet (large Accept/Decline buttons)
- [x] Call state management (shared HSM call state machine on kiosk and portal)
- [x] Missed call handling ("no answer" timeout state)
- [x] Screen share (portal → kiosk via getDisplayMedia)
- [x] ICE disconnect grace period and call setup timeout
- [x] Structured WebRTC logging and production-visible call lifecycle logs

### Phase 3.6: Capacitor Native Apps — 🚧 In Progress

- [x] Capacitor wrapper for kiosk (Android APK)
- [x] Lock Task Mode (prevent app exit)
- [x] Auto-launch on boot
- [x] Secure storage migration (device_token to Capacitor Preferences)
- [x] Capacitor wrapper for portal (Android APK with client-side auth)
- [x] Device Owner + DeviceAdminReceiver on kiosk
- [x] Custom Capacitor plugin for silent APK install
- [x] Release pipeline (automated build, sign, upload) — `npm run release:kiosk|portal`
- [x] Backend release upload/query endpoints and `app_releases` table
- [x] WebSocket `app:update` trigger and version reporting in heartbeat
- [ ] Foreground service for persistent WebSocket
- [ ] Firebase Cloud Messaging (FCM for push notifications)
- [ ] Native incoming call UI on caretaker phones

**Screens**:

- ✅ Devices (portal device list)
- ✅ Pair Tablet (QR scanning flow)
- ✅ Tablet QR Pairing (kiosk pairing screen)
- ✅ Tablet Home (profile selection)
- ✅ Tablet Profile Dashboard (caretaker cards)
- ✅ Tablet Incoming Call (Phase 3.5)
- ✅ Portal Call UI (Phase 3.5)

---

## 🔮 Phase 4: Polish and Sharing — Future

Refine experience with collaboration, AI improvements, and notifications.

### Key Deliverables

- Email invitations with roles (invite viewers, assign read-only access)
- Role management UI (view, change, revoke member access)
- AI search improvements (better ranking, synonyms, natural language queries)
- AI health history summarization (generate summaries from documents and journals)
- Medication reminders (push notifications for medication schedules)
- Tablet display customization (font size, brightness, content rotation)
- Performance optimization (image compression, lazy loading, caching)
- Offline resilience (graceful degradation on intermittent network)

---

## How to Update This Roadmap

1. Check off items as features are completed
2. Move phases from "Planned" to "Next Up" to "Complete" as work progresses
3. Update "Current Status" section to reflect the active phase
4. Add notes or dates for significant milestones if needed

---

**Last Updated**: 2026-04-21
