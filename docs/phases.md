# Implementation Phases

Phased delivery plan from MVP to full platform. Each phase builds on the previous. See [features.md](features.md) for detailed specifications and [architecture.md](architecture.md) for technical decisions.

---

## Phase 1: Foundation (MVP)

Establish authentication, core data structures, and basic health tracking.

### Key Deliverables

- **Auth system** -- Email + OTP via Nodemailer + Gmail SMTP; 6-digit code, 15-minute expiry; JWT in httpOnly cookie; first-time login prompts for first and last name
- **Monorepo setup** -- npm workspaces with `packages/portal`, `backend`, `shared`, `mobile`
- **Database** -- PostgreSQL running in Docker, schema managed with Drizzle ORM
- **Group creation** -- Create and name a group during onboarding
- **Care profile CRUD** -- Add, edit, and remove profiles with name, photo, relationship, date of birth, and known conditions
- **Medication management** -- Add/edit/remove medications via modal; fields: name, dosage, schedule (multi-select: morning/afternoon/evening/bedtime), status (active/discontinued); discontinued medications hidden by default with a "Show discontinued" toggle
- **Home dashboard** -- Card grid showing all profiles; each card displays name, relationship, conditions (tags), and active medication count
- **Profile detail view** -- Overview and Medications tabs
- **Deployment** -- Production Docker Compose with Traefik reverse proxy, Let's Encrypt SSL, separate portal/backend containers, PostgreSQL with persistent volume
- **Mobile-responsive layout** -- Bottom navigation, card-based UI, mobile-first

### Screens Implemented

- Login (`designs/01-login.svg`)
- Home Dashboard (`designs/02-home-dashboard.svg`)
- Profile Detail (`designs/03-profile-detail.svg`)
- Medications (`designs/04-medications.svg`)

---

## Phase 2: Calendar and Documents

Add scheduling, journaling, and AI-powered document management.

### Key Deliverables

- **Calendar view** -- Monthly calendar with event dots and list of upcoming events
- **Event CRUD** -- Create, edit, delete appointments with type, date, location, and notes
- **Event attachments** -- Upload and link documents to calendar events ✅
- **Journal entries** -- Free-form entries linked to dates and optionally to calendar events ✅
- **Journal attachments** -- Upload and link documents to journal entries ✅
- **Key takeaways** -- Summary field on journal entries for quick scanning ✅
- **Journal full-text search** -- PostgreSQL full-text search across title, content, and key takeaways ✅
- **Journal starred entries** -- Star/bookmark entries for quick access ✅
- **Attachment upload** -- Camera capture and file upload, assigned to care profiles ✅
- **OCR text extraction** -- Automatic processing on upload via Google Vision API ✅
- **Attachment categorization** -- Auto-categorization (lab results, prescriptions, insurance, billing, imaging) ✅
- **Auto-generated descriptions** -- AI-generated descriptions from OCR content ✅
- **Full-text search** -- PostgreSQL full-text search across OCR-extracted text ✅
- **Documents tab** -- Search/browse view across all profile attachments ✅

### Screens Implemented

- Calendar (`designs/05-calendar.svg`)
- Journal Tab (`designs/06-journal-entry.svg`) ✅
- Journal Entry Detail (`designs/06b-journal-detail.svg`) ✅
- Journal Entry Modal (`designs/06c-journal-modal.svg`) ✅
- Documents Tab (`designs/07-documents.svg`) ✅
- Attachment Detail (`designs/08-document-detail.svg`) ✅

---

## Phase 3: Tablet and Communication

Enable the tablet kiosk experience, Capacitor mobile app, and real-time communication.

### Phase 3.0: Kiosk Foundation ✅

**Completed:**

- [x] **Device database schema** -- devices, device_care_profiles, device_access, device_pairing_tokens tables with migrations
- [x] **Device API endpoints** -- Registration, pairing, validation, management (12 endpoints)
- [x] **Device authentication** -- deviceAuth middleware validates device_token (separate from user JWT)
- [x] **WebSocket server** -- Real-time communication on `/ws` path with device token authentication
- [x] **WebSocket events** -- device_paired, device_revoked, profiles_updated, heartbeat, status_update
- [x] **Kiosk package** -- `packages/kiosk` SvelteKit app (port 9393)
- [x] **Kiosk pairing screen** -- QR code display with auto-refresh (4-min interval)
- [x] **Kiosk home screen** -- Profile card grid for multi-profile devices
- [x] **Kiosk profile dashboard** -- Greeting, caretaker cards, appointments list
- [x] **Kiosk design system** -- 80px touch targets, 20px base font, high contrast
- [x] **Connection management** -- Auto-reconnect with exponential backoff, online/offline indicator
- [x] **Device management UI** -- Portal device list, pairing flow, profile assignment, unpair
- [x] **Remote unpair** -- Sends device_revoked event to clear kiosk data

### Phase 3.5: Video Calling (Planned)

- **WebRTC video calling** -- Caretaker-to-tablet and tablet-to-caretaker calls
- **Incoming call screen (tablet)** -- Full-screen display with large Accept/Decline buttons
- **Call state management** -- Call stores and UI on both kiosk and portal
- **Missed call handling** -- "No answer" timeout state

### Phase 3.6: Capacitor Native (Planned)

- **Capacitor native apps** -- Wrap SvelteKit in Capacitor for both caretaker phone APK and tablet kiosk APK
- **Firebase Cloud Messaging** -- FCM integration for high-priority push notifications
- **Native incoming call UI** -- Full-screen call notification on caretaker's phone with ringtone
- **Tablet kiosk APK** -- Capacitor app with Lock Task Mode, auto-launch on boot, foreground service
- **Capgo OTA updates** -- Over-the-air web bundle updates; automatic updates without APK reinstall

### Screens Implemented

- Devices — Portal device list ✅
- Pair Tablet — QR scanning flow ✅
- Tablet QR Pairing — Kiosk pairing screen ✅
- Tablet Home — Profile selection ✅
- Tablet Profile Dashboard — Caretaker cards and appointments ✅
- Tablet Incoming Call — (Phase 3.5)
- Portal Call UI — (Phase 3.5)

---

## Phase 4: Polish and Sharing

Refine the experience with collaboration, AI improvements, and notifications.

### Key Deliverables

- **Email invitations with roles** -- Invite viewers by email, assign read-only access, manage active invitations
- **Role management UI** -- View, change, and revoke member access from settings
- **AI search improvements** -- Better ranking, synonym matching, and natural language queries over document text
- **AI health history summarization** -- Generate summaries from accumulated documents and journal entries
- **Medication reminders** -- Push notifications to caretakers for medication schedules
- **Tablet display customization** -- Adjust font size, brightness, content rotation from portal
- **Performance optimization** -- Image compression, lazy loading, caching, database query optimization
- **Offline resilience** -- Graceful degradation when network is intermittent on tablet
