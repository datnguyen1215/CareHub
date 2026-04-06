# Implementation Phases

Phased delivery plan from MVP to full platform. Each phase builds on the previous. See [features.md](features.md) for detailed specifications and [architecture.md](architecture.md) for technical decisions.

---

## Phase 1: Foundation (MVP)

Establish authentication, core data structures, and basic health tracking.

### Key Deliverables

- **Auth system** -- Email + OTP via Nodemailer + Gmail SMTP; 6-digit code, 15-minute expiry; JWT in httpOnly cookie; first-time login prompts for first and last name
- **Monorepo setup** -- npm workspaces with `packages/portal`, `backend`, `shared`, `kiosk`
- **Database** -- PostgreSQL running in Docker, schema managed with Drizzle ORM
- **Group creation** -- Create and name a group during onboarding
- **Care profile CRUD** -- Add, edit, and remove profiles with name, photo, relationship, date of birth, and known conditions
- **Medication management** -- Add/edit/remove medications via modal; fields: name, dosage, schedule (multi-select: morning/afternoon/evening/bedtime), status (active/discontinued); discontinued medications hidden by default with a "Show discontinued" toggle
- **Home dashboard** -- Card grid showing all profiles; each card displays name, relationship, conditions (tags), and active medication count
- **Profile detail view** -- Tabbed interface with Overview, Medications, Calendar, Journal, and Documents panels
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

### Phase 3.5: Video Calling (In Progress)

**Completed:**

- [x] **Portal WebSocket client** -- Real-time signaling connection with JWT auth (`/ws?jwt={token}`)
- [x] **Auto-reconnect** -- Exponential backoff (1s → 2s → 4s → max 30s), auth failure handling
- [x] **WebRTC peer manager** -- Local media (720p, echo cancel), SDP negotiation, ICE gathering
- [x] **Call state machine** -- Hierarchical state machine (@datnguyen1215/hsmjs) with guards, logging, and ICE candidate queueing
- [x] **Call state store** -- State machine-based store with reactive UI state mapping
- [x] **Call actions** -- `initiateCall()`, `endCall()`, `toggleMute()`, `toggleVideo()`, `toggleScreenShare()`
- [x] **Signaling integration** -- WebSocket message routing, ICE candidate exchange
- [x] **Error handling** -- getUserMedia errors, ICE failure detection, WebSocket disconnect
- [x] **Layout integration** -- WebSocket connects on app mount, handlers auto-initialized
- [x] **State machine guards** -- Prevent invalid transitions, queue ICE candidates before peer connection ready
- [x] **Call lifecycle logging** -- Key lifecycle events (initiated, incoming, accepted/declined, connecting, connected, ended, failed) logged at warn level via `logCallLifecycle()` (always visible in production); verbose events (ICE candidates, SDP, timers) logged at debug level via `logWebRTCEvent()` (silenced in production)
- [x] **Setup timeout** -- ICE negotiation in `connecting` state automatically fails after 15s (`CALL_SETUP_TIMEOUT_MS`) if connection stalls, with user-friendly error and retry option
- [x] **ICE disconnected grace period** -- `connected` state uses hierarchical sub-states (`stable`/`unstable`); on `ICE_DISCONNECTED`, call enters `unstable` with a 10s reconnect timer (`RECONNECT_TIMEOUT_MS`); recovers to `stable` on `ICE_CONNECTED`, fails on timeout; prevents dropped calls on brief network blips
- [x] **WebSocket heartbeat** -- Ping every 25 seconds with 5-second pong timeout; dead connections detected within 30 seconds
- [x] **Message queue** -- Signaling messages buffered during disconnection (max 50, 30s TTL), flushed on reconnect; priority-based eviction drops lowest-priority messages first (critical SDP/ICE preserved)
- [x] **Tab visibility handling** -- Detects hidden tab during call; on return, forces immediate reconnect if WebSocket disconnected, recovers dead local media streams via track replacement
- [x] **Backend ping/pong** -- User WebSocket handler supports `ping` messages and responds with `pong`
- [x] **Race condition prevention** -- Old socket event handlers nulled before close to prevent stale events from corrupting new connections
- [x] **Multi-tab signal isolation** -- `handleIncomingSignal()` skips signals when tab call state is idle; prevents duplicate SDP offers and conflicting ICE negotiations when a user has multiple portal tabs open
- [x] **Real-time device status** -- `device_status_changed` WebSocket events broadcast from backend; portal `deviceStatus.svelte.ts` store seeded from REST API on load and updated reactively; device list, device detail, DeviceCard, and OverviewPanel all reflect live status; call button disabled state derived from live store; `handleCall` guards in devices page and OverviewPanel use `getDeviceStatus()` for defense-in-depth

- [x] **Call UI components** -- Full-screen call interface on portal with CallModal and CallControls
- [x] **Portal call initiation** -- Call from device detail page and profile overview tab, both wired to call store

- [x] **Call state reactivity** -- Portal call store uses Svelte 5 `$state` runes with direct import reactivity (components import `callState` directly); Kiosk still uses `subscribe()` pattern (not yet migrated)

- [x] **Kiosk screen share display** -- CallScreen layout adapts when caretaker shares screen: `object-fit: contain` with light gray background, "Screen shared by [name]" indicator; state driven by `call:screen-share` signaling message via `isRemoteScreenSharing` in CallState

**Planned:**

- **Incoming call screen (tablet)** -- Full-screen display with large Accept/Decline buttons
- **Kiosk call initiation** -- Tap caretaker card to start call
- **Missed call handling** -- "No answer" timeout state; backend sends `call:ended` (reason: `missed`) to both portal and kiosk on 30s ring timeout, kiosk returns to idle

### Phase 3.6: Capacitor Native (In Progress)

**Completed:**

- [x] **Capacitor kiosk integration** -- Android platform initialized with core plugins (Preferences, Network, App)
- [x] **Static adapter** -- SvelteKit configured for SPA mode (adapter-static) for Capacitor compatibility
- [x] **Secure storage** -- Capacitor Preferences for device token with localStorage fallback
- [x] **Android project** -- Capacitor Android platform with Lock Task Mode, auto-launch on boot, foreground service permissions
- [x] **Build workflow** -- Scripts for `cap:sync`, `cap:open`, `cap:build`
- [x] **Capacitor portal integration** -- Portal configured with adapter-static, Capacitor Android platform, and client-side auth
- [x] **Device Owner provisioning** -- `DeviceAdminReceiver` registered in manifest with `BIND_DEVICE_ADMIN` permission; `device_admin.xml` declares empty `<uses-policies>` (Device Owner inherits all privileges); `REQUEST_INSTALL_PACKAGES` and `REQUEST_DELETE_PACKAGES` permissions added; one-time ADB provisioning script at `packages/kiosk/scripts/provision-device-owner.sh`; setup steps documented in `packages/kiosk/SETUP.md`

**Planned:**

- **Firebase Cloud Messaging** -- FCM integration for high-priority push notifications
- **Native incoming call UI** -- Full-screen call notification on caretaker's phone with ringtone
- **Foreground service implementation** -- Keep WebSocket alive on tablet
- **Silent APK updates** -- Use Device Owner `DevicePolicyManager` to install APK updates without user interaction
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
