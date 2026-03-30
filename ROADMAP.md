# CareHub Roadmap

Project milestones and progress tracking for CareHub healthcare management platform.

> For detailed feature specifications, see [docs/phases.md](docs/phases.md) and [docs/features.md](docs/features.md).

---

## Current Status

**Phase 1: Foundation (MVP)** — ✅ Complete
Core authentication, profiles, medications, and deployment infrastructure are live.

---

## ✅ Phase 1: Foundation (MVP) — Complete

Established authentication, core data structures, and basic health tracking.

- [x] Auth system (Email + OTP via Nodemailer, JWT in httpOnly cookies)
- [x] Monorepo setup (npm workspaces: frontend, backend, shared, mobile)
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

## 🚧 Phase 2: Calendar and Documents — Next Up

Add scheduling, journaling, and AI-powered document management.

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

## 📅 Phase 3: Tablet and Communication — Planned

Enable tablet kiosk experience and real-time communication.

### Key Deliverables

- Capacitor native apps (caretaker phone + tablet kiosk)
- Firebase Cloud Messaging (FCM for push notifications)
- Native incoming call UI (full-screen call notifications on phones)
- Tablet kiosk APK (Lock Task Mode, auto-launch on boot)
- Capgo OTA updates (over-the-air updates without APK reinstall)
- Tablet kiosk UI (elderly-friendly interface, 80px+ touch targets)
- QR-based pairing (one-time token with 5-minute expiry)
- Device management (status, battery, last seen)
- WebRTC video calling (caretaker-to-tablet and tablet-to-caretaker)
- Remote content push (photos, appointments, messages to tablet)
- Real-time device status (online/offline via WebSocket)

**Screens**: Devices, Pair Tablet, Tablet Home, Tablet Incoming Call, Tablet QR Pairing

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

**Last Updated**: 2026-03-30
