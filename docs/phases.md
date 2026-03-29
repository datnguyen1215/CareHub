# Implementation Phases

Phased delivery plan from MVP to full platform. Each phase builds on the previous. See [features.md](features.md) for detailed specifications and [architecture.md](architecture.md) for technical decisions.

---

## Phase 1: Foundation (MVP)

Establish authentication, core data structures, and basic health tracking.

### Key Deliverables

- **Auth system** -- Email + OTP via Nodemailer + Gmail SMTP; 6-digit code, 15-minute expiry; JWT in httpOnly cookie; first-time login prompts for first and last name
- **Monorepo setup** -- npm workspaces with `packages/frontend`, `backend`, `shared`, `mobile`
- **Database** -- PostgreSQL running in Docker, schema managed with Drizzle ORM
- **Group creation** -- Create and name a group during onboarding
- **Care profile CRUD** -- Add, edit, and remove profiles with name, photo, relationship, date of birth, and known conditions
- **Medication management** -- Add/edit/remove medications via modal; fields: name, dosage, schedule (multi-select: morning/afternoon/evening/bedtime), status (active/discontinued); discontinued medications hidden by default with a "Show discontinued" toggle
- **Home dashboard** -- Card grid showing all profiles; each card displays name, relationship, conditions (tags), and active medication count
- **Profile detail view** -- Overview and Medications tabs
- **Deployment** -- Production Docker Compose with Traefik reverse proxy, Let's Encrypt SSL, separate frontend/backend containers, PostgreSQL with persistent volume
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
- **Journal entries** -- Free-form entries linked to dates and optionally to calendar events
- **Key takeaways** -- Summary field on journal entries for quick scanning
- **Document upload** -- Camera capture and file upload, assigned to care profiles
- **OCR text extraction** -- Automatic processing on upload via Google Vision API or equivalent
- **Document categorization** -- Auto-categorization (lab results, prescriptions, insurance, billing, imaging)
- **Manual tagging** -- User-defined tags on documents
- **Full-text search** -- PostgreSQL full-text search across OCR-extracted text
- **Cross-linking** -- Documents linkable to calendar events and journal entries

### Screens Implemented

- Calendar (`designs/05-calendar.svg`)
- Journal Entry (`designs/06-journal-entry.svg`)
- Documents (`designs/07-documents.svg`)
- Document Detail (`designs/08-document-detail.svg`)

---

## Phase 3: Tablet and Communication

Enable the tablet kiosk experience, Capacitor mobile app, and real-time communication.

### Key Deliverables

- **Capacitor native apps** -- Wrap SvelteKit in Capacitor for both caretaker phone APK and tablet kiosk APK (same codebase, no separate mobile development)
- **Firebase Cloud Messaging** -- FCM integration for high-priority push notifications (call alerts, medication reminders) on both caretaker phones and tablets
- **Native incoming call UI** -- Full-screen call notification on caretaker's phone with ringtone, vibration, caller photo, and Accept/Decline buttons (phone-style experience, works over lock screen)
- **Tablet kiosk APK** -- Capacitor app with Lock Task Mode (prevents exit), auto-launch on boot, foreground service for persistent WebSocket
- **Capgo OTA updates** -- Over-the-air web bundle updates for all Capacitor apps; tablets and phones update automatically without manual APK reinstall
- **Tablet kiosk UI** -- Elderly-friendly interface with 80px+ touch targets, no text input
- **Kiosk home screen** -- Personalized greeting, caretaker cards, today's schedule
- **QR-based pairing** -- Tablet displays QR, caretaker scans from portal, one-time token with 5-minute expiry
- **Device management** -- Device list in portal with status, battery, last seen
- **Device access sharing** -- Share device control with other caretakers via email
- **Remote unpair** -- Remove tablet pairing from portal
- **WebRTC video calling** -- Caretaker-to-tablet and tablet-to-caretaker calls with foreground service to keep calls alive
- **Incoming call screen (tablet)** -- Full-screen display with large Accept/Decline buttons on tablet
- **Missed call handling** -- "No answer" timeout state on tablet, missed call indicator for caretaker
- **Remote content push** -- Send photos, appointments, and messages to tablet from portal
- **Real-time device status** -- Online/offline and battery via WebSocket connection
- **Auto-reconnect** -- Tablet app reconnects automatically on network interruption; FCM serves as fallback wake mechanism

### Screens Implemented

- Devices (`designs/09-devices.svg`)
- Pair Tablet (`designs/10-pair-tablet.svg`)
- Tablet Home (`designs/11-tablet-home.svg`)
- Tablet Incoming Call (`designs/12-tablet-incoming-call.svg`)
- Tablet QR Pairing (`designs/13-tablet-qr-pairing.svg`)

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
