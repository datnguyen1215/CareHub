# Technical Architecture

## Stack

| Layer              | Technology                                                        | Rationale                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package Manager    | npm with workspaces                                               | Monorepo support, standard tooling                                                                                                                                               |
| Frontend           | SvelteKit + Tailwind CSS                                          | SSR + SPA hybrid, mobile-first responsive, fast builds                                                                                                                           |
| Backend/API        | Express + nodemon                                                 | Separate service, clear API boundary, fast dev iteration                                                                                                                         |
| Validation         | Zod                                                               | Declarative request validation schemas with middleware; replaces ad-hoc inline checks across all routes                                                                            |
| Database           | PostgreSQL via Docker (self-hosted)                               | Relational data, full control, no external dependency                                                                                                                            |
| ORM / Migrations   | Drizzle ORM                                                       | Type-safe queries, SQL-first migrations                                                                                                                                          |
| Auth               | Email + OTP (Nodemailer + Gmail SMTP)                             | Passwordless email login without third-party auth service                                                                                                                        |
| File Storage       | Local disk (`data/releases/`)                                     | APK files stored outside the static web directory; path configurable via `RELEASES_DIR` env var; served via authenticated download endpoint                                     |
| Real-time          | WebSockets (custom)                                               | Tablet push, device status, call signaling                                                                                                                                       |
| Video Calling      | WebRTC + @datnguyen1215/hsmjs                                     | Peer-to-peer video with hierarchical state machines for call lifecycle management                                                                                                |
| Push Notifications | Firebase Cloud Messaging (FCM)                                    | High-priority data messages for call notifications; reliable delivery even when app is closed                                                                                    |
| Native App Shell   | Capacitor                                                         | Wraps SvelteKit web app in native Android shell for both caretaker phones and elderly tablets; enables native push, full-screen call intent, foreground services, lock task mode |
| OTA Updates        | Capgo (self-hosted)                                               | Over-the-air web bundle updates for all Capacitor apps; no manual APK reinstall for UI/logic changes                                                                             |
| OCR/AI             | Google Vision API or AWS Textract                                 | Document text extraction; Tesseract as self-hosted alternative                                                                                                                   |
| Search             | PostgreSQL full-text search                                       | Search over OCR-extracted text, no extra infrastructure                                                                                                                          |
| Hosting            | Self-hosted via Docker — Traefik reverse proxy, Let's Encrypt SSL | Full control, no cloud vendor dependency                                                                                                                                         |
| Testing            | Vitest + Supertest + Testing Library                              | Backend integration tests (Supertest); portal unit and component tests (Vitest, jsdom, @testing-library/svelte)                                                                 |
| TypeScript         | Default SvelteKit config                                          | Standard configuration, no custom overrides                                                                                                                                      |
| Linting            | ESLint + Prettier (SvelteKit defaults)                            | Consistent code style with minimal setup                                                                                                                                         |
| Tablet Runtime     | Capacitor APK with Android Lock Task Mode                         | Native app shell prevents exit, auto-restarts on boot; WebSocket stays alive via foreground service                                                                              |

---

## Monorepo Structure

```
packages/
  portal/      # SvelteKit + Tailwind CSS caretaker portal web app with Capacitor (Android APK)
  backend/     # Express API server with WebSocket support + Zod request validation
  shared/      # Shared types, utilities, Drizzle schema, and UI logic
  kiosk/       # SvelteKit elderly tablet kiosk app with Capacitor (Android only)
```

---

## Portal Route Structure

The SvelteKit portal uses a route group `(app)` to wrap all authenticated main pages with a shared layout.

```
src/
  lib/
    api.ts                 # API client with auth cookie handling
    components/
      navigation/
        TopBar.svelte          # Fixed top bar — "CareHub" branding left, user avatar right
        BottomNav.svelte       # Fixed bottom navigation — Home, Profiles, Devices, Settings tabs
      ui/
        Toast.svelte           # Toast notification component — displays success/error/destructive messages (backed by shared store)
      profiles/
        ProfileModal.svelte    # Create/edit care profile modal
      medications/
        MedicationModal.svelte # Create/edit medication modal — name, dosage, schedule chips, status toggle (edit only)
      events/
        EventModal.svelte      # Create/edit event modal — title, date/time, type, location, notes
      shared/
        DeleteConfirmModal.svelte # Confirmation dialog for deleting events
      call/
        CallModal.svelte       # Call modal — device name, status, mute/video toggle, end-call button
      documents/
        AttachmentUpload.svelte # File upload component with camera capture, category selection, progress bar, and error recovery with retry
    utils/
      error-utils.ts         # Error display utilities — getErrorMessage() for user-friendly messages, isRetryable() for retry eligibility
      focusTrap.ts           # Focus trap utility for modal dialogs
    stores/
      toast.svelte.ts        # Toast notification store (Svelte 5 $state runes) — delegates to shared createToastStore(), wraps in $state for reactivity
      call.svelte.ts         # Call state store (Svelte 5 $state runes) — idle → calling → connected → ended
      deviceStatus.svelte.ts # Reactive device status store — seeded from REST API on page load, updated in real-time via device_status_changed WebSocket events; getDeviceStatus(id, fallback), seedDeviceStatuses(devices), seedDeviceStatus(device), initializeDeviceStatusHandlers()
    utils/
      format.ts            # Date/time formatting (formatDateShort, formatDateLong, formatDateFull, formatDateDefault, formatDateTime, formatTime, formatWeekdayLong, formatMonthYear, formatRelativeTime) and string helpers (getInitial)
      debounce.ts          # debounce() utility with .cancel() method for cleanup
      categories.ts        # Shared CATEGORY_COLORS, CATEGORY_LABELS, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS maps
  routes/
    login/                 # Public auth pages (email entry, OTP verify, account setup)
    (app)/
      +layout.svelte       # Shared layout: TopBar + main content area + BottomNav; initializes WebSocket, call handlers, and device status handlers on mount
      +error.svelte        # Error boundary — user-friendly error page for unhandled route errors with Go back / Go home actions
      +page.svelte         # Home page — upcoming events list grouped by day with 7/14/30 day range toggle, loading skeleton, error state with retry
      profiles/
        +page.svelte       # Profile list — profile card grid, loading skeleton, error state with retry
        [id]/
          +page.svelte     # Profile detail — custom top bar, tab switcher, loading skeleton, error state with retry; delegates to panel components
      devices/
        +page.svelte       # Device management UI — list, pair, unpair devices, loading skeleton, error state with retry; opens CallModal on Call button
      settings/
        +page.svelte       # Settings — group rename, member management
```

### Shared Layout (`(app)` route group)

All main pages (home, profiles, devices, settings) are wrapped by `src/routes/(app)/+layout.svelte`, which renders:

1. `TopBar` — Fixed top bar with "CareHub" title and user avatar (`z-40`). Avatar fetches `GET /api/users/me` and displays the user's initial. Tapping navigates to `/settings`.
2. `<main>` — Page content with top and bottom padding to clear the fixed bars.
3. `Toast` — Toast notification component positioned above bottom navigation (`z-[60]`) to display success, error, and destructive messages. Backed by shared `createToastStore()` from `@carehub/shared/ui/toast` with portal-specific styling (bottom position, compact sizing). Success/destructive toasts auto-dismiss after 3 seconds; error toasts auto-dismiss after 10 seconds.
4. `BottomNav` — Fixed bottom navigation with four tabs (`z-40`). Active tab is highlighted with primary blue using the `$page` store. Tabs: Home (`/`), Profiles (`/profiles`), Devices (`/devices`), Settings (`/settings`).

Unhandled route errors are caught by `+error.svelte`, which displays a user-friendly error page with "Go back" and "Go home" recovery actions. Error messages are contextualized by HTTP status code (404, 403, 401, 5xx). The raw error message is shown in a styled code block when it differs from the generic message.

### Error Display Convention

Error handling follows a consistent pattern across the portal:

- **API errors on page load** → inline error message with retry button (catches at page level; `getErrorMessage()` from `error-utils.ts` produces user-friendly text; `isRetryable()` determines whether a Retry button is shown)
- **API errors on user action** (save, delete, create) → toast notification
- **Validation errors** → inline field-level messages
- **Unhandled route errors** → `+error.svelte` error boundary catches all unhandled errors from child routes

### Profile Detail Page (`/profiles/:id`)

The profile detail page lives inside the `(app)` route group, so the global `TopBar` and `BottomNav` are always rendered by the shared layout. The page additionally renders its own fixed top bar inside `<main>`, which visually replaces the global top bar but stacks a second `h-14` spacer — a known layout issue to be fixed in a future pass (move the route out of `(app)` or suppress the global TopBar on this page). It contains:

1. **Custom top bar** — Back arrow (→ `/profiles`), profile name centered, pencil-icon edit button that opens `ProfileModal` (`z-40`, same as global TopBar).
2. **Tab bar** — Sticky below the top bar (`z-30`, below navigation). Five tabs: **Overview** (default), **Meds**, **Calendar**, **Journal**, **Docs**. Active tab is underlined with primary blue. All panels are mounted at once using the `hidden` attribute (eager loading), so tab switching is instant without re-fetches.
3. **Panel components** — Each tab's logic, state, and API calls are encapsulated in a dedicated panel component that owns its own data fetching on mount:
   - `OverviewPanel` (`profiles/OverviewPanel.svelte`) — Receives `profile` prop. Shows device card(s) for linked devices (name, online/offline status, battery level, Call/Settings buttons; disabled when offline; empty state when no device linked), profile info card (name, relationship, date of birth, conditions as badges), recent medications card, and upcoming events. Fetches supplementary data (devices, medications, events) independently via `$effect`. Dispatches `profileUpdate` on delete.
   - `MedicationsPanel` (`medications/MedicationsPanel.svelte`) — Receives `profileId` prop. Full medication management: add/edit/discontinue medications via `MedicationModal`, with a "Show discontinued" toggle. Owns all medication state and API calls.
   - `CalendarPanel` (`events/CalendarPanel.svelte`) — Receives `profileId` and `profileName` props. Month navigation, calendar grid with derived `calendarDays`, event list for selected day, event CRUD via `EventModal`. Caches loaded month via `loadedMonthKey` to avoid re-fetching the same month. Supports cross-tab navigation from `DocumentsTab` via `initialEventId`.
   - `JournalPanel` (`journal/JournalPanel.svelte`) — Receives `profileId` prop. Wraps existing `JournalTab` with entry detail view and add/edit modals. Owns journal entry state, search/sort, and selected entry. Supports cross-tab navigation from `DocumentsTab` via `initialEntryId`.
   - `DocumentsTab` (`documents/DocumentsTab.svelte`) — Already self-contained. Search/browse view with category filtering. Can navigate to Journal or Calendar tabs via callback props.
4. **Parent page responsibilities** — The parent `+page.svelte` (~255 lines) only handles: loading the profile, rendering the tab bar, switching between panels, profile edit modal, loading skeleton, and error state with retry (including 401 → `/login` redirect).

### Auth Guard

`src/hooks.server.ts` enforces authentication for all non-login routes. Unauthenticated requests to any route outside `/login` are redirected to `/login`.

---

## Data Model

### Entity Relationship Overview

```
Group
  |-- has many --> User (via GroupMember)
  |-- has many --> CareProfile
                      |-- has many --> Medication
                      |-- has many --> CalendarEvent
                      |-- has many --> JournalEntry
                      |-- has many --> Attachment
                      |-- assigned to --> Device (many-to-many)

User
  |-- belongs to --> Group (via GroupMember)
  |-- has many --> DeviceAccess

Device
  |-- assigned --> CareProfile (many-to-many)
  |-- has many --> DeviceAccess

Attachment
  |-- belongs to --> CareProfile (required)
  |-- optionally linked to --> CalendarEvent
  |-- optionally linked to --> JournalEntry

AppRelease  (standalone — tracks APK builds for OTA distribution)
```

### Entities

All entities are defined as Drizzle ORM schemas in `packages/shared`.

**User**

- `id` (UUID, primary key)
- `email` (unique)
- `first_name`
- `last_name`
- `avatar_url`
- `created_at`

**Group**

- `id` (UUID, primary key)
- `name`
- `created_at`

**GroupMember** (join table)

- `user_id` (FK -> User)
- `group_id` (FK -> Group)
- `role` (enum: admin, viewer)
- `created_at`

**CareProfile**

- `id` (UUID, primary key)
- `group_id` (FK -> Group)
- `name`
- `avatar_url`
- `date_of_birth`
- `relationship` (e.g., grandmother, father)
- `conditions` (text array)
- `created_at`, `updated_at`

**Medication**

- `id` (UUID, primary key)
- `care_profile_id` (FK -> CareProfile)
- `name`
- `dosage`
- `schedule` (text array: morning, afternoon, evening, bedtime)
- `status` (enum: active, discontinued)
- `created_at`, `updated_at`

**Otp**

- `id` (UUID, primary key)
- `email`
- `code` (6 digits)
- `expires_at` (15 minutes from creation)
- `created_at`

**CalendarEvent**

- `id` (UUID, primary key)
- `care_profile_id` (FK -> CareProfile)
- `title`
- `event_type` (enum: doctor_visit, lab_work, therapy, general)
- `start_datetime`
- `end_datetime` (optional)
- `location`
- `notes`
- `created_at`, `updated_at`

**JournalEntry**

- `id` (UUID, primary key)
- `care_profile_id` (FK -> CareProfile)
- `calendar_event_id` (FK -> CalendarEvent, optional)
- `content` (text)
- `key_takeaways` (text)
- `date`
- `created_at`, `updated_at`

**Attachment**

- `id` (UUID, primary key)
- `profile_id` (FK -> CareProfile, required)
- `event_id` (FK -> CalendarEvent, optional)
- `journal_id` (FK -> JournalEntry, optional)
- `file_url` (string)
- `description` (text, AI-generated from OCR)
- `ocr_text` (text, indexed for full-text search)
- `category` (enum: lab_result, prescription, insurance, billing, imaging, other)
- `created_at`, `updated_at`

**Device**

- `id` (UUID, primary key)
- `device_token` (unique, used for device authentication)
- `name`
- `status` (enum: online, offline)
- `battery_level` (integer, nullable)
- `last_seen_at`
- `paired_at`
- `created_at`
- `app_version` (varchar, nullable) — semver string of the app version currently installed on the device, as last reported by the kiosk on check-in; null until the device reports its version

**DeviceCareProfile** (join table)

- `device_id` (FK -> Device, cascade delete)
- `care_profile_id` (FK -> CareProfile, cascade delete)

**DeviceAccess**

- `id` (UUID, primary key)
- `device_id` (FK -> Device, cascade delete)
- `user_id` (FK -> User, cascade delete)
- `granted_at`
- `granted_by` (FK -> User)

**DevicePairingToken**

- `id` (UUID, primary key)
- `token` (varchar, unique) - QR code content
- `device_id` (FK -> Device, nullable) - Null until device claims it
- `expires_at` (timestamp) - 5 minute expiry
- `created_at` (timestamp)

**AppRelease**

- `id` (UUID, primary key)
- `app` (enum: `AppType` — `kiosk`, `portal`) — which application this release targets
- `version` (varchar) — human-readable semver string, e.g. `"1.2.0"`
- `version_code` (integer) — Android versionCode, monotonically increasing; used to determine whether a device needs an update
- `file_path` (varchar) — server-side path to the stored APK file
- `file_size` (integer, bytes) — used to display download progress on the device; int4 is sufficient since APKs are well under 2 GB
- `checksum` (varchar) — SHA-256 hex digest; verified by the device after download to ensure file integrity
- `notes` (text, nullable) — optional human-readable release notes
- `created_at` (timestamp)
- **Unique index** on `(app, version_code)` — enforces that each versionCode is unique per app and enables efficient latest-version queries

> **API response shape** — `GET /api/releases/latest` returns a subset: `{ id, app, version, notes, created_at }`. Fields `version_code`, `file_path`, `file_size`, and `checksum` are omitted from the portal-facing response. The portal `Release` TypeScript interface reflects this subset.

**CallSession**

- `id` (UUID, primary key)
- `caller_user_id` (FK -> User, NOT NULL)
- `callee_device_id` (FK -> Device, **nullable** — set to NULL via `ON DELETE SET NULL` when the device is deleted; historical call records are preserved)
- `callee_profile_id` (FK -> CareProfile, nullable)
- `status` (enum: initiating, ringing, connecting, connected, ended, failed)
- `initiated_at` (timestamp)
- `answered_at` (timestamp, nullable)
- `ended_at` (timestamp, nullable)
- `end_reason` (enum: completed, declined, missed, failed, cancelled, nullable)
- `duration_seconds` (integer, nullable)

---

## Key Architecture Decisions

### Web-Based Core with Capacitor Native Shell

All interfaces are built with SvelteKit as web applications. Both the caretaker phone app and the elderly tablet kiosk are wrapped in Capacitor to produce native Android APKs from the same codebase. The desktop caretaker portal remains a standard web app accessed through the browser. Capacitor enables native push notifications (FCM), phone-style incoming call UI, foreground services, lock task mode (tablet), and auto-restart on boot (tablet). No separate mobile development is required -- the entire UI is Svelte 5 running in a web view.

### Mobile-First Responsive Design

The caretaker portal is designed mobile-first since most interactions (photo capture at doctor visits, quick medication checks) happen on phones. Desktop layout adapts from the mobile base.

### Separate Portal and Backend Services

The portal (SvelteKit) and backend (Express) are separate packages in the monorepo. The Express backend exposes a REST API consumed by the portal. This separation allows independent deployment, clearer API boundaries, and straightforward integration testing with Supertest.

### Real-Time via WebSockets

Tablet push notifications, device status monitoring, and video call signaling all use persistent WebSocket connections managed by the Express backend.

**WebSocket Server Architecture:**

- Mounted on `/ws` path alongside REST API
- Dual authentication: device tokens (query param `token`) for kiosks, JWT (query param `jwt`) for users
- Client registry tracks connected devices and users separately with multi-tab support for users
- Ping/pong for connection health (30s interval)
- Updates `last_seen_at` and `status` on device connect/disconnect
- `initWebSocketServer(server)` returns the `WebSocketServer` instance so `index.ts` can coordinate shutdown
- Graceful shutdown is centralized in `packages/backend/src/index.ts`: SIGTERM/SIGINT handlers call `clearAllClients()`, `wss.close()`, and `server.close()`, then `process.exit(0)`; a 5-second unref'd timeout forces exit if lingering timers stall the close callback

**Client Registry:**

- `packages/backend/src/websocket/clients.ts` - Central registry with key format `device:{id}` or `user:{id}`
- Devices: single connection per device
- Users: multiple connections supported (multi-tab browser sessions); `broadcastToUser()` sends to all user connections, so each tab must filter signals based on its own call state; idle tabs log a `warn`-level message when discarding incoming signals (visible in production)
- Functions: `broadcastToDevice()`, `broadcastToUser()`, `isDeviceConnected()`, `isUserConnected()`, `getConnectedUserIds()`
- Return values: `broadcastToDevice()` returns `boolean` (true if device was connected and message sent); `broadcastToUser()` returns `number` (count of connections message was sent to, 0 if user not connected)
- The call handler (`call.ts`) checks every broadcast return value and logs at `warn` level when delivery fails (recipient disconnected); SDP answer delivery failure logs at `error` level since an undelivered answer causes the call to hang indefinitely

**Message Handlers:**

- `packages/backend/src/websocket/handlers/device.ts` - Device heartbeat (persists `last_seen_at`, `battery_level`, `app_version`), status updates, and OTA update status handling (`app:update-status`); exposes `getUsersWithDeviceAccess()` helper that intersects connected portal user IDs with DB `DeviceAccess` rows, used by both `broadcastDeviceStatus` and `handleAppUpdateStatus`
- `packages/backend/src/websocket/handlers/user.ts` - User connection with JWT authentication, heartbeat ping/pong support
- `packages/backend/src/websocket/handlers/call.ts` - Call signaling (offer/answer/ICE/screen-share)

**Events (Server → Kiosk):**

- `device_paired` - Pairing completed, includes assigned profiles
- `device_revoked` - Device unpaired, kiosk should clear data
- `profiles_updated` - Profile assignments changed
- `call:incoming` - Incoming call from user with caller info
- `call:accepted` - Device accepted call
- `call:declined` - Device declined call
- `call:ended` - Call terminated by either party
- `call:offer` - SDP offer from user (WebRTC)
- `call:answer` - SDP answer from device (WebRTC)
- `call:ice-candidate` - ICE candidate for WebRTC connection
- `call:screen-share` - Screen share state change from portal (active/inactive)
- `app:update` - Trigger OTA app update; payload: `{ releaseId, version, downloadUrl, checksum }` — kiosk downloads APK, verifies checksum, and installs silently via Device Owner mode

**Events (Kiosk → Server):**

- `heartbeat` - Periodic ping with optional `batteryLevel` (number) and `appVersion` (semver string); persists `last_seen_at`, `battery_level`, and `app_version` on the device record when provided
- `status_update` - Online/offline state changes
- `call:accepted` - Device accepts incoming call
- `call:declined` - Device declines incoming call
- `call:ended` - Device ends call
- `call:answer` - SDP answer to user's offer
- `call:ice-candidate` - ICE candidate for WebRTC connection
- `app:update-status` - OTA update progress; payload: `{ releaseId, status: 'downloading'|'installing'|'success'|'failed', version?, error? }`; on `success` the backend persists the new version and notifies portal users; on all statuses, portal users with device access receive the status event

**Events (Server → Portal Users):**

- `device_status_changed` - Device connected or disconnected; payload `{ deviceId, status: 'online' | 'offline' }`; broadcast to all connected portal users who have `DeviceAccess` for that device; DB query is skipped if no portal users are currently connected
- `call:ringing` - Forwarded from device when it receives an incoming call
- `call:accepted` - Device accepted the call
- `call:declined` - Device declined the call
- `call:ended` - Call terminated (reason: `missed`, `failed`, `declined`, or `ended`)
- `call:answer` - SDP answer from device (WebRTC)
- `call:ice-candidate` - ICE candidate for WebRTC connection
- `pong` - Response to `ping` heartbeat
- `app:update-status` - OTA update progress forwarded from device; payload: `{ deviceId, releaseId, status, version?, error? }`; sent to all portal users with access to the updating device

**Events (Server → Portal/User):**

- `device_status_changed` - Broadcast to the device owner when device OTA update status changes; shape: `{ type, deviceId, updateStatus, updateProgress }`
  - `updateStatus`: `"downloading"` | `"complete"` | `"failed"`
  - `updateProgress`: number 0–100 (present when `updateStatus` is `"downloading"`)

**Events (User → Server):**

- `ping` - Heartbeat keep-alive (server responds with `pong`)
- `call:initiate` - Initiate call to device (creates call_sessions record)
- `call:offer` - SDP offer to device (WebRTC)
- `call:ice-candidate` - ICE candidate for WebRTC connection
- `call:ended` - User ends call
- `call:screen-share` - Screen share state change (portal-only, forwarded to device)

**Call Flow:**

1. User sends `call:initiate` with deviceId and profileId
2. Server validates permission, checks device online, creates call_sessions record
3. Server forwards `call:incoming` to device with caller info
4. Server starts 30-second ring timeout
5. Device sends `call:accepted` or `call:declined`
6. If accepted, WebRTC offer/answer/ICE exchange begins
7. Either party can send `call:ended` to terminate
8. Server updates call_sessions with duration and end reason
9. On ring timeout (30s unanswered): server sends `call:ended` (reason: `missed`) to both the user and the device, then ends the session
10. On device deletion (`DELETE /api/devices/:id`): any active call on that device is atomically ended with reason `cancelled` inside the same database transaction that deletes the device; both the caller user and the device receive `call:ended` (reason: `cancelled`) via WebSocket after the transaction commits

**Call Service:**

`packages/backend/src/services/call.ts` manages call session database operations:

- `tryCreateCallSession()` - Atomically check and create session (prevents race conditions)
- `updateCallStatus()` - Update call status (initiating → ringing → connecting → connected)
- `endCall()` - End call with reason (idempotent, calculates duration)
- `validateCallPermission()` - Check user has access to device
- Ring timeout handling (marks calls as 'missed' after 30 seconds; sends `call:ended` to both user and device)
- Terminal state protection (prevents overwriting ended calls)
- `CallSessionRecord.calleeDeviceId` is typed `string | null` — NULL when the device has been deleted; all signal routing handlers guard against null before forwarding messages to the device

**Portal WebSocket Client:**

Portal connects to WebSocket on app mount via JWT authentication (`/ws?jwt={token}`). Connection features:

- WebSocket URL built via shared `buildWsUrl()` (protocol-aware ws:/wss: detection)
- Message parsing via shared `parseMessage()`
- Automatic reconnection with exponential backoff via shared `createReconnectStrategy()` (1s → 2s → 4s → max 30s)
- Immediate reconnect (bypasses backoff) for urgent recovery scenarios (e.g., tab visibility restore)
- Auth failure detection (close code 4001) triggers redirect to login
- Real-time signaling message routing for video call coordination and device status updates
- Connection state management (connecting/connected/disconnected)
- Heartbeat keep-alive: sends `ping` every 25 seconds; detects dead connections within 30 seconds (5s pong timeout)
- Message queue: messages sent during disconnection are buffered (max 50, 30s TTL) and flushed on reconnect; priority-based eviction drops lowest-priority messages first — critical WebRTC signaling (SDP offers/answers, ICE candidates) is preserved over less urgent messages (screen-share state, errors, device status updates)
- Race condition prevention: old socket event handlers are nulled before closing to prevent stale async events from corrupting new connections
- Initialized in `(app)/+layout.svelte` on mount for all authenticated pages; also initializes `initializeDeviceStatusHandlers()` from `deviceStatus.svelte.ts` to route `device_status_changed` messages into the reactive device status store

### Peer-to-Peer Video

Video calls use WebRTC for direct peer-to-peer connections, avoiding the cost and complexity of a media server. STUN servers handle NAT traversal. A TURN relay serves as fallback when direct connection fails.

**Shared WebRTC/WebSocket Utilities:**

Common UI, WebRTC, and WebSocket logic is extracted into the shared package to avoid duplication between Portal and Kiosk:

**Shared UI Utilities:**

- `packages/shared/src/ui/toast.ts` — `createToastStore()` factory function for framework-agnostic toast notification management; types (`Toast`, `ToastType` with success/error/warning/info/destructive); configurable auto-dismiss durations per type; subscriber pattern for reactivity; both portal and kiosk delegate their toast/notification stores to this shared logic (Svelte components remain in each app to handle app-specific positioning and sizing)

**Shared WebRTC/WebSocket Utilities:**

- `packages/shared/src/webrtc/messages.ts` — TypeScript interfaces for all WebSocket signaling messages (`SignalingMessage` union); includes `DeviceStatusChangedMessage` (`type: 'device_status_changed'`, `deviceId`, `status: 'online' | 'offline'`) used by both backend broadcast and portal device status store; `AppUpdateMessage` (server→device OTA trigger) and `AppUpdateStatusMessage` (device→server OTA progress) with `AppUpdateStatus` union type (`'downloading' | 'installing' | 'success' | 'failed'`)
- `packages/shared/src/webrtc/webrtc-core.ts` — Peer connection cleanup, stream acquisition (`acquireLocalStream`), stream cleanup (`cleanupStream`), peer connection cleanup (`cleanupPeerConnection`), default media constraints (720p video, echo cancellation), re-exports `ICE_SERVERS`
- `packages/shared/src/webrtc/error-utils.ts` — `getUserFriendlyError()` maps technical errors to user-friendly messages
- `packages/shared/src/webrtc/call-utils.ts` — `createDurationTimer()` for call length tracking, `getTopLevelState()` for state machine state parsing
- `packages/shared/src/websocket/connection.ts` — `buildWsUrl()` for protocol-aware WebSocket URL construction, `parseMessage()` for JSON message parsing, `createReconnectStrategy()` (exponential backoff) and `createFixedReconnectStrategy()` for reconnection
- `packages/shared/src/logger.ts` — Lightweight structured logger with `debug`, `info`, `warn`, and `error` methods; `debug`/`info` silenced in production builds (checks `import.meta.env.DEV`), `warn`/`error` always log; used by all WebRTC, WebSocket, and call store code in both portal and kiosk

**Kiosk WebRTC Implementation:**

The kiosk operates as the callee (receiver) in all video calls:

- `packages/kiosk/src/lib/services/webrtc.ts` — WebRTC manager for peer connections, SDP handling, ICE candidate exchange, and media stream management (imports stream/cleanup utilities from shared)
- `packages/kiosk/src/lib/services/websocket.ts` — Extended with call signaling message handlers and methods to send call responses (imports URL builder and reconnect strategy from shared); also handles OTA update routing: `routeUpdateMessage()` dispatches incoming `app:update` WebSocket messages to `handleAppUpdate()`, deferring the update (stored in `pendingUpdate`) if a call is active; `handleAppUpdate()` calls `SilentUpdate.downloadAndInstall()`, streams `downloadProgress` events back as `app:update-status` messages, and transitions the update store through `downloading → installing → success | failed`; `flushPendingUpdate()` is exported for `call.ts` to invoke when a call ends; app version is fetched once at connect time via `SilentUpdate.getCurrentVersion()` and cached in `cachedAppVersion`, then included in every heartbeat payload as `appVersion`
- `packages/kiosk/src/lib/stores/call.ts` — Call state store with subscription-based cross-module reactivity and hierarchical state machine for lifecycle management (imports error utils, duration timer, and state helpers from shared); note: kiosk still uses manual subscription (not yet migrated to direct import); handles `call:screen-share` signaling messages to toggle `isRemoteScreenSharing` state for display layout adaptation; `resetCallState()` calls `flushPendingUpdate()` to apply any OTA update that arrived while a call was active
- `packages/kiosk/src/lib/stores/update.ts` — Reactive OTA update state store; tracks `updateStatus` (`idle | downloading | installing | success | failed`), `updateProgress` (0–100 download percentage), and `updateError` (string or null); exposes `subscribe()`, `getUpdateState()`, `setUpdateStatus()`, and `setUpdateProgress()` for use by the websocket service and any UI components that display an update indicator; `isUpdating` flag in `websocket.ts` prevents concurrent update attempts
- `packages/shared/src/webrtc/call-state-machine.ts` — Shared state machine configuration, event definitions, and context types

**Portal WebRTC Implementation:**

The portal operates as the caller (initiator) in all video calls:

**WebRTC Manager (`packages/portal/src/lib/services/webrtc.ts`):**

- Peer connection lifecycle with ICE server configuration (imports `ICE_SERVERS` from shared)
- Local media stream acquisition via shared `acquireLocalStream()` with 720p video and echo cancellation
- SDP offer/answer negotiation for call setup
- ICE candidate gathering with configurable timeout (imports `ICE_GATHERING_TIMEOUT_MS` from shared)
- Remote stream attachment to video elements
- Audio/video track toggle without reconnection
- Connection state monitoring with automatic failure detection
- Stream and connection cleanup via shared `cleanupStream()` and `cleanupPeerConnection()`
- Peer connection access via `getPeerConnection()` for track replacement during media recovery

**Call State Store (`packages/portal/src/lib/stores/call.svelte.ts`):**

- Call state store using Svelte 5 `$state` runes with hierarchical state machine for lifecycle management
- State flow: idle → initiating → signaling → connecting → connected → ending/failed → idle
- Signaling sub-states ensure proper sequencing (waitingForAccept → creatingOffer → exchangingIce)
- **Connected sub-states** — `connected` is a hierarchical state with `stable` and `unstable` sub-states; `ICE_DISCONNECTED` transitions from `stable` to `unstable` and starts a 10-second reconnect timer (`RECONNECT_TIMEOUT_MS`); `ICE_CONNECTED` transitions back to `stable`; timer expiry transitions to `failed`
- Guards prevent invalid transitions (e.g., sending ICE candidates before peer connection exists)
- Key lifecycle state transitions logged at warn level (always visible in production) via shared `logCallLifecycle()`; verbose events (ICE candidates, SDP, timers) remain at debug level via `logWebRTCEvent()`
- Call only marked "connected" when ICE connection actually established
- Pending ICE candidates queued and flushed when appropriate
- Local and remote stream management (stream cleanup via shared utilities)
- Call duration counter via shared `createDurationTimer()` (updates every second when connected)
- Mute and video toggle controls
- Screen share toggle via `getDisplayMedia()` with `replaceTrack()` (no renegotiation); original camera track saved for restoration; screen stream `ended` event handled for browser/OS stop; cleanup on call end
- WebSocket signaling integration (ICE candidates, SDP exchange)
- **Multi-tab signal isolation** — `handleIncomingSignal()` returns early when `callState.status === 'idle'`; only the tab that called `initiateCall()` (which transitions to `'initiating'` synchronously) is non-idle when signaling messages arrive via WebSocket, so other open tabs silently ignore them
- Error messages via shared `getUserFriendlyError()`
- Top-level state parsing via shared `getTopLevelState()` — `getTopLevelState('connected.unstable')` returns `'connected'`, so existing UI status mapping works without changes
- Reconnect timer actions: `startReconnectTimer`, `clearReconnectTimer`, `logEnterUnstable`
- Automatic cleanup on call end or error (clears both setup and reconnect timers)
- **Tab visibility handling** — `visibilitychange` listener detects when the tab is hidden during an active call; on return to visible, checks WebSocket health (forces immediate reconnect if disconnected) and recovers dead local media streams by re-acquiring and replacing tracks on the peer connection; video sender is skipped during recovery when screen sharing is active to prevent overwriting the screen track
- **Direct import reactivity** — components import `callState` directly; Svelte 5 tracks `$state` dependencies automatically across module boundaries, no manual subscription needed

**Call UI Components:**

- `packages/portal/src/lib/components/call/CallModal.svelte` - Full-screen modal for active calls
  - Displays call status with appropriate UI for each state (initiating/ringing/connecting/connected/ended/failed)
  - Remote video fills screen, local video in picture-in-picture corner (hidden during screen share)
  - Status bar shows device name, connection status, "Sharing screen" indicator, and duration timer (MM:SS format)
  - Error handling with retry option for retryable errors
  - Focus trap and Escape key to end call
  - Accessibility: keyboard navigation, screen reader announcements
- `packages/portal/src/lib/components/call/CallControls.svelte` - Control buttons for active calls
  - Mute/unmute microphone (M key, shows red when muted)
  - Toggle video on/off (V key, shows red when off, hides local preview)
  - Toggle screen share on/off (S key, shows green when sharing, Heroicons `computer-desktop` icon)
  - End call button (red background, Escape key)
  - Controls disabled during initiating/ringing/connecting states
  - Integrated into device detail page (`/devices/[id]`) via CallModal
- `packages/kiosk/src/lib/components/call/CallOverlay.svelte` - Kiosk call overlay that dispatches to IncomingCall, CallScreen, or PermissionError based on state
  - Uses `subscribe()` for real-time state updates (no polling)
  - Unsubscribes on component destroy
  - Passes `isRemoteScreenSharing` prop to CallScreen for screen share layout adaptation
- `packages/kiosk/src/lib/components/call/CallScreen.svelte` - Full-screen call display on the kiosk tablet
  - Remote video fills screen with `object-fit: cover` (normal) or `object-fit: contain` (screen share mode)
  - Screen share mode switches background to light gray (`#f5f5f5`) for document visibility
  - Shows "Screen shared by [caller name]" indicator when screen sharing is active
  - Local video in picture-in-picture corner, call status and duration in header

**Call State Machine (`packages/shared/src/webrtc/call-state-machine.ts`):**

Both Portal and Kiosk use hierarchical state machines (via `@datnguyen1215/hsmjs`) for call lifecycle management:

**State Flow:**

- Top-level states: `idle → initiating → signaling → connecting → connected → ending → idle`
- Failed states branch from `connecting` or `connected` to `failed → idle`
- `connecting` state has a setup timeout (`CALL_SETUP_TIMEOUT_MS`, 15s) that transitions to `failed` if ICE negotiation stalls
- `connected` state is hierarchical with `stable` and `unstable` sub-states; `ICE_DISCONNECTED` transitions `stable` → `unstable` (starts 10s reconnect timer), `ICE_CONNECTED` transitions `unstable` → `stable`, `RECONNECT_TIMEOUT` transitions `unstable` → `failed`

**Signaling Sub-States:**

- Caller (Portal): `waitingForAccept → creatingOffer → exchangingIce`
- Callee (Kiosk): `incoming → acquiringMedia → waitingForOffer → creatingAnswer → exchangingIce`

**Key Guards:**

- Cannot send ICE candidates unless in `signaling` or `connecting` state
- Cannot create offer unless peer connection exists and local stream attached
- Cannot transition to `connected` unless ICE connection state is `connected`
- Cannot accept call unless in `incoming` state
- Kiosk rejects incoming calls when not idle: sends `call:declined` back to the server so the caller receives explicit feedback instead of silence
- ICE candidates received before peer connection ready are queued in `pendingIceCandidates` and flushed when entering `connecting` state

**Logging:**

- All logging uses the shared `logger` from `packages/shared/src/logger.ts` (`debug`/`info` silenced in production, `warn`/`error` always visible)
- Two logging functions in `call-state-machine.ts`:
  - `logCallLifecycle(eventType, details)` — uses `logger.warn` (always visible in production); used for key lifecycle events: call initiated, incoming, accepted/declined, connected, ended, failed, and top-level state entries (`idle`, `initiating`, `connecting`, `connected`, `ending`, `failed`). Uses `warn` because `logger.info` is suppressed in production.
  - `logWebRTCEvent(eventType, details)` — uses `logger.debug` (suppressed in production); used for verbose events: ICE candidates, SDP offer/answer details, timer start/clear, connection state changes, signaling sub-state entries
- All state transitions also logged at debug level with format: `[Call:WebRTC:TIMESTAMP] oldState → newState (trigger: eventName)`
- Dropped signals logged at `warn` level: idle tabs log the discarded message type (`handleIncomingSignal: dropping message while idle, type: …`); `initiateCall` logs when rejected due to non-idle state

**Events:**

- User actions: `INITIATE`, `ACCEPT`, `DECLINE`, `END`, `CANCEL`
- Signaling: `INCOMING_CALL`, `CALL_ACCEPTED`, `CALL_DECLINED`, `CALL_ENDED`, `CALL_ERROR`
- SDP: `OFFER_CREATED`, `OFFER_RECEIVED`, `ANSWER_CREATED`, `ANSWER_RECEIVED`
- ICE: `ICE_CANDIDATE`, `ICE_CONNECTED`, `ICE_DISCONNECTED`, `ICE_FAILED`
- Media: `LOCAL_STREAM_READY`, `REMOTE_STREAM_READY`, `MEDIA_ERROR`
- Internal: `CLEANUP_COMPLETE`, `SETUP_TIMEOUT`, `RECONNECT_TIMEOUT`

**Context:**

- Shared context between Portal and Kiosk includes: `callId`, `targetDeviceId`, `caller`, `profileId`, `localStream`, `remoteStream`, `startedAt`, `duration`, `error`, `endReason`, `isMuted`, `isVideoOff`, `pendingIceCandidates`, `isScreenSharing`, `isRemoteScreenSharing`
- Context is reset to initial state when returning to `idle` after cleanup

### Capacitor Native Apps

Both the caretaker phone app and the elderly tablet kiosk are Capacitor APKs built from the same SvelteKit codebase. Each uses a different entry point (caretaker portal vs. kiosk UI) but shares all underlying code.

**Caretaker phone app enables:**

- **Native push notifications via FCM** -- High-priority data messages wake the device and bypass Doze mode, ensuring call notifications are delivered even when the app is closed or the screen is off.
- **Full-screen call intent** -- Incoming calls display a native full-screen notification over the lock screen (using Android's `fullScreenIntent`), identical to how WhatsApp or a regular phone call behaves. Shows caller name, photo, and large Accept/Decline buttons.
- **Foreground service** -- Keeps the WebRTC connection alive during active calls so Android does not kill the process.

**Tablet kiosk app enables:**

- **Device Owner mode** -- One-time ADB provisioning (`adb shell dpm set-device-owner`) grants system-level permissions for:
  - Lock Task Mode (pins app to screen, prevents exit)
  - Power button interception (dims screen instead of locking device)
  - Keyguard disabled (no lock screen)
  - Auto-restart on crash
  - Silent APK installation via `PackageInstaller` (no user prompt required)
- **Auto-launch on boot** -- App starts automatically when the tablet powers on (e.g., after a power outage or reboot).
- **Foreground service** -- Keeps the WebSocket connection alive so the tablet is always reachable for incoming calls and content pushes.
- **Power management** -- Screen dims to near-black (1-5% brightness) when idle, instant wake on touch or incoming call. Device never truly sleeps, avoiding the need for FCM push notifications.
- **Silent APK updates** -- `SilentUpdate` custom Capacitor plugin downloads a new APK from the backend, verifies its SHA-256 checksum and APK signing certificate, and installs it via `PackageInstaller` without any user prompt. See [Silent APK Update Plugin](#silent-apk-update-plugin) below.

**No separate codebase** -- The entire UI remains Svelte 5 running in a web view. Capacitor only provides the native bridge for push notifications, call UI, kiosk lock-down, background services, and silent APK updates.

### Over-the-Air Updates

**Capgo (web bundle updates):**
All Capacitor apps (caretaker phones and elderly tablets) receive UI and logic updates over-the-air via Capgo (self-hosted). This avoids manually sideloading a new APK for every change.

- App checks for updates periodically (e.g., every hour) or on launch.
- New web bundles are downloaded silently in the background.
- Updates apply on next app restart -- no user interaction required.
- APK rebuild is only needed when native plugins or Capacitor configuration change (rare after initial setup).
- Elderly tablets update automatically with zero intervention.

### Release Pipeline

Signed APK builds and uploads are automated via `scripts/release.sh` in each app package.

```bash
npm run release:kiosk -- --version 1.2.0
npm run release:portal -- --version 1.2.0
```

The script: validates prerequisites (`ANDROID_HOME`, keystore, `.env.release`), increments `versionCode` and sets `versionName` in `build.gradle`, runs the Vite build and Capacitor sync, builds a signed APK via Gradle, then uploads it to `POST /api/releases/upload` (multipart/form-data: `file`, `app`, `version`, `version_code`).

Signing credentials are stored in a gitignored `.env.release` file in each package directory. See [RELEASING.md](../RELEASING.md) for full setup and usage.

### Silent APK Update Plugin

The kiosk uses a custom Capacitor plugin (`SilentUpdate`) to download and install APK updates without user interaction, using Device Owner privileges.

**Java implementation (`packages/kiosk/android/app/src/main/java/us/dnguyen/carehub/kiosk/`):**

- **`SilentUpdatePlugin.java`** — `@CapacitorPlugin(name = "SilentUpdate")` registered in `MainActivity.onCreate()`. Exposes two `@PluginMethod`s:
  - `downloadAndInstall({ url, checksum })` — Downloads APK from `url` (HTTPS enforced; HTTP rejected) to internal app storage as `pending_update_<callbackId>.apk` (unique filename per call to prevent concurrent-download race conditions). Verifies SHA-256 checksum, verifies APK signing certificate matches the currently-running app's certificate (prevents a compromised server from pushing a malicious APK), then commits a `PackageInstaller` session. Fires `downloadProgress` plugin events during download. Deletes the downloaded APK on checksum/signature failure or after a successful install (handled by `InstallStatusReceiver`). Resolves/rejects the JS promise asynchronously via `InstallStatusReceiver`.
  - `getCurrentVersion()` — Returns `{ version: BuildConfig.VERSION_NAME, versionCode: BuildConfig.VERSION_CODE }`.
- **`InstallStatusReceiver.java`** — `BroadcastReceiver` (registered in `AndroidManifest.xml` with `android:exported="false"`) that receives `PackageInstaller` session commit results. Resolves or rejects the pending `PluginCall` based on `PackageInstaller.EXTRA_STATUS`. Pending calls are stored in a static `ConcurrentHashMap<String, PluginCall>` keyed by Capacitor callback ID (necessary because the receiver is a separate class and cannot access the plugin's bridge-saved calls). Deletes the APK file on both success and failure.

**Security — APK signature verification:**

Before committing the install session, the plugin compares the signing certificate of the downloaded APK against the certificate of the currently-installed app:

1. Get current app signing certificates via `PackageManager.getPackageInfo(packageName, GET_SIGNING_CERTIFICATES)`.
2. Extract the signing certificate from the downloaded APK using `PackageParser` / `ApkSignatureVerifier`.
3. Compute SHA-256 fingerprints of both certificates and compare them.
4. Reject the install and delete the APK if fingerprints do not match.

This ensures only APKs signed with the same keystore as the production build can be installed — a compromised server cannot push an APK signed with a different key.

**JS bridge (`packages/kiosk/src/lib/plugins/silent-update.ts`):**

- Registers the native plugin via `registerPlugin('SilentUpdate')`.
- Exports a `SilentUpdatePlugin` TypeScript interface with `downloadAndInstall()`, `getCurrentVersion()`, and `addListener()` for `downloadProgress` events.
- Includes a browser fallback that logs warnings instead of crashing in dev/web mode.

**Usage from Svelte/TypeScript:**

```ts
import { SilentUpdate } from '$lib/plugins/silent-update';

// Listen for progress
await SilentUpdate.addListener('downloadProgress', ({ percent }) => {
  console.log(`Download: ${percent}%`);
});

// Download, verify, and install
await SilentUpdate.downloadAndInstall({ url, checksum });

// Get current version
const { version, versionCode } = await SilentUpdate.getCurrentVersion();
```

**Server-initiated APK updates (OTA update trigger):**
For full APK updates (native plugin changes, Capacitor version bumps), the portal can push a new APK to a kiosk device remotely:

1. Admin uploads a new APK release via `POST /api/releases/upload` (stores file in `data/releases/`, records metadata in `app_releases` table).
2. Admin triggers update via `POST /api/devices/:id/update` with `{ releaseId }`.
   - Returns 409 if the device is offline.
   - Sends `app:update` WebSocket message to the device with `{ releaseId, version, downloadUrl, checksum }`.
3. Kiosk downloads the APK from the authenticated `GET /api/releases/:id/download` endpoint, verifies the SHA-256 checksum, and installs silently via Device Owner mode.
4. Kiosk reports progress back to the server via `app:update-status` messages (`downloading` → `installing` → `success` | `failed`).
5. On `success`, the backend persists the new `app_version` on the device record and forwards the status to portal users.
6. Portal users receive `app:update-status` events for all intermediate statuses so the UI can show update progress.

The device's currently installed version is tracked in the `app_version` column on the `devices` table, updated both on successful OTA install and via the `appVersion` field in heartbeat messages.

### Push Notification Strategy (FCM for Portal Only)

**Decision:** FCM is only used for the caretaker phone app (portal), NOT the kiosk tablet.

**Rationale:**

- **Caretaker phone:** The app gets backgrounded or killed by Android's aggressive power management. FCM high-priority data messages are the only reliable way to wake the device for incoming calls, even when the screen is off or the app is closed. Without FCM, the caretaker would miss calls.

- **Kiosk tablet:** Runs in Device Owner mode with a persistent foreground service. The WebSocket connection stays alive continuously. The device never truly sleeps (screen dims instead), so push notifications are not needed. The tablet is always reachable via WebSocket for incoming calls and content updates.

**Firebase project structure:**

- Single Android app registration: `us.dnguyen.carehub.portal`
- Only one `google-services.json` file needed (for portal package)
- FCM tokens stored in `users` table (not `devices` table)

**Incoming call flow:**

1. Elderly family member taps a caretaker's photo on the tablet kiosk app.
2. Tablet app sends a call request to the server via WebSocket (kept alive by foreground service).
3. Server sends a **high-priority FCM data message** to the caretaker's device, containing caller name, photo URL, and call session ID.
4. Capacitor FCM plugin receives the message and triggers a **full-screen incoming call notification** with ringtone and vibration.
5. Caretaker taps Accept -- app opens (or foregrounds) and WebRTC call connects.
6. If the caretaker does not answer within a timeout, the tablet shows a "no answer" state.

### Kiosk Power Management (Device Owner + Screen Dimming)

**Decision:** Use Device Owner mode with screen dimming instead of letting the device sleep.

**Rationale:**

Elderly users are energy-conscious and may expect the screen to be "off" when not in use. However, allowing the device to truly sleep would break the WebSocket connection and require FCM for waking, adding unnecessary complexity.

**Solution:**

- Screen dims to near-black (1-5% brightness) when idle, giving the appearance of being "off"
- Instant wake on touch or incoming call
- Device remains fully active underneath, WebSocket stays alive
- No need for FCM push notifications on the kiosk

**Device Owner mode enables:**

- **Power button interception** -- Power button dims the screen instead of locking the device
- **Lock Task Mode** -- Prevents app exit, notification shade access, or app switching
- **Keyguard disabled** -- No lock screen ever appears
- **Auto-restart on crash** -- App automatically restarts if it crashes
- **Auto-launch on boot** -- Already configured via Capacitor

**Trade-off accepted:** Requires one-time `adb shell dpm set-device-owner` command during initial tablet setup (see Kiosk Device Setup section below).

### OCR at Upload Time

Documents are processed through OCR immediately on upload. The extracted text is stored in the `ocr_text` column and indexed with PostgreSQL full-text search. This avoids runtime processing delays during search and keeps the search infrastructure simple.

Both OCR extraction and AI description generation are wrapped with timeout guards (60s for OCR, 30s for AI) using a `withTimeout` helper that races the operation against a deadline. If a step times out, it is skipped with a warning log and the attachment is saved with partial results (e.g., no OCR text or no AI description). This prevents background processing tasks from blocking indefinitely on large/corrupt images or stalled API calls.

### QR Pairing with Expiring Tokens

Tablet pairing uses a one-time token with a 5-minute expiry. The tablet displays the token as a QR code. The caretaker scans it with their phone camera from the portal. This avoids manual code entry and prevents stale pairing sessions.

**Pairing Flow:**

1. Kiosk calls `POST /api/devices/register` to create device record and get device_token
2. Kiosk calls `POST /api/devices/pairing-token` to generate QR token (5-min expiry)
3. Kiosk displays QR code and auto-refreshes every 4 minutes
4. Caretaker scans QR from portal and calls `POST /api/devices/pair` with token
5. Server checks actual WebSocket connection status and sets device status accordingly (online if connected, offline if not)
6. Server sends `device_paired` event via WebSocket
7. Kiosk stores device_token and navigates to home screen

### Device Authentication

Devices use device tokens (not user JWTs) for authentication. The `deviceAuth` middleware validates `Authorization: Bearer <device_token>` headers on kiosk-specific endpoints. Device tokens are stored securely via Capacitor Preferences API on native Android (with localStorage fallback for browser testing) and never expire (until device is unpaired).

### Authentication

Email + OTP passwordless login via Nodemailer + Gmail SMTP.

- User submits their email address
- Server generates a 6-digit OTP, stores it in the `Otp` table with a 15-minute expiry, and sends it via email
- User submits the OTP; server verifies it and issues a JWT stored in an httpOnly cookie (no expiration)
- First-time login creates a new `User` record and redirects to `/login/setup`
- On the setup page the user enters their `first_name` and `last_name`; on submit the portal:
  1. Calls `PATCH /api/users/me` to save the profile
  2. Calls `POST /api/groups` with `{ name: "My Family" }` to auto-create a default group (creator is assigned the `admin` role via `GroupMember`)
  3. Redirects to `/` (dashboard)

**API Endpoints**

| Method   | Path                                                       | Auth        | Description                                                                                                            |
| -------- | ---------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/auth/email`                                          | Public      | Send OTP to email address (body validated with Zod)                                                                   |
| `POST`   | `/api/auth/verify`                                         | Public      | Verify OTP; issues JWT httpOnly cookie (body validated with Zod)                                                      |
| `PATCH`  | `/api/users/me`                                            | Required    | Update authenticated user's first and last name                                                                        |
| `POST`   | `/api/groups`                                              | Required    | Create a group; creator is added as admin                                                                              |
| `PATCH`  | `/api/groups/:id`                                          | Required    | Rename a group (admin only)                                                                                            |
| `GET`    | `/api/groups`                                              | Required    | Return all groups the authenticated user belongs to                                                                    |
| `POST`   | `/api/groups/:groupId/profiles`                            | Admin only  | Create a care profile; `name` required (body validated with Zod)                                                       |
| `GET`    | `/api/groups/:groupId/profiles`                            | Member only | List all care profiles in the group                                                                                    |
| `GET`    | `/api/groups/:groupId/profiles/:id`                        | Member only | Get a single care profile                                                                                              |
| `PATCH`  | `/api/groups/:groupId/profiles/:id`                        | Admin only  | Partial update of any care profile field (body validated with Zod)                                                     |
| `DELETE` | `/api/groups/:groupId/profiles/:id`                        | Admin only  | Delete a care profile                                                                                                  |
| `POST`   | `/api/groups/:groupId/profiles/:profileId/medications`     | Member only | Create a medication; `name` required; optional: `dosage`, `schedule`, `status` (body validated with Zod)               |
| `GET`    | `/api/groups/:groupId/profiles/:profileId/medications`     | Member only | List medications; active only by default; add `?include_discontinued=true` to include discontinued ones                |
| `PATCH`  | `/api/groups/:groupId/profiles/:profileId/medications/:id` | Member only | Partial update of any medication field; use `status: "discontinued"` to discontinue (body validated with Zod)          |
| `DELETE` | `/api/groups/:groupId/profiles/:profileId/medications/:id` | Member only | Hard delete a medication                                                                                               |
| `GET`    | `/api/health`                                              | Public      | Health check — returns `{ status: "ok" }`; used by Traefik and Docker health checks                                    |
| `POST`   | `/api/devices/register`                                    | Public      | Register new device; returns device_token                                                                              |
| `GET`    | `/api/devices/me`                                          | Device Auth | Validate device token; returns device info with assigned profiles                                                      |
| `POST`   | `/api/devices/pairing-token`                               | Device Auth | Generate QR pairing token (5-min expiry)                                                                               |
| `GET`    | `/api/devices/pairing-status`                              | Device Auth | Poll for pairing completion                                                                                            |
| `GET`    | `/api/devices`                                             | Required    | List devices user has access to                                                                                        |
| `POST`   | `/api/devices/pair`                                        | Required    | Complete pairing by scanning QR token; link device to profiles; sets status based on actual WebSocket connection state |
| `GET`    | `/api/devices/:id`                                         | Required    | Get device details (requires access); response includes `appVersion` (current installed app semver, nullable)          |
| `PATCH`  | `/api/devices/:id`                                         | Required    | Update device name (body validated with Zod)                                                                           |
| `DELETE` | `/api/devices/:id`                                         | Required    | Unpair/remove device                                                                                                   |
| `POST`   | `/api/devices/:id/update`                                  | Required    | Trigger OTA APK update; body: `{ releaseId }`; returns 409 if device offline; sends `app:update` WS message to device |
| `POST`   | `/api/devices/:id/profiles`                                | Required    | Assign profiles to device (body validated with Zod)                                                                    |
| `DELETE` | `/api/devices/:id/profiles/:profileId`                     | Required    | Remove profile from device                                                                                             |
| `POST`   | `/api/releases/upload`                                     | Required    | Upload an APK release; multipart/form-data with `file`, `app`, `version`, `version_code`, `notes`; validates APK magic bytes; returns 201 with release metadata (excludes `file_path`) |
| `GET`    | `/api/releases/latest?app=kiosk\|portal`                   | Required    | Return the release with the highest `version_code` for the given app type; returns `Release` or 204 if none published  |
| `GET`    | `/api/releases/:id/download`                               | Device Auth | Serve the APK binary for download (`Content-Type: application/vnd.android.package-archive`); validates device token    |

**SMTP configuration via environment variables:**

| Variable         | Description                   |
| ---------------- | ----------------------------- |
| `SMTP_HOST`      | SMTP server hostname          |
| `SMTP_PORT`      | SMTP server port              |
| `SMTP_USER`      | SMTP username / email address |
| `SMTP_PASS`      | SMTP password or app password |
| `SMTP_FROM_NAME` | Display name for sent emails  |

A dedicated Gmail account is recommended for sending OTP emails.

**Release storage configuration:**

| Variable       | Description                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `RELEASES_DIR` | Absolute path to the directory where APK files are stored on disk. Defaults to `data/releases/` relative to the process working directory. Must be outside the static web directory to prevent direct URL access. Directory is created automatically if it does not exist. |

### Request Validation

All POST and PATCH endpoints use Zod schemas for request validation. Schemas are defined in `packages/backend/src/schemas/` (one file per domain: `auth.ts`, `profiles.ts`, `medications.ts`, `events.ts`, `journal.ts`, `attachments.ts`, `devices.ts`, `query.ts`). Validation is applied via Express middleware in `src/middleware/validate.ts`:

- `validate(schema)` — validates `req.body` against a Zod schema, returns 400 with the first error message on failure
- `validateQuery(schema)` — validates `req.query` against a Zod schema (used for pagination params like `limit` and `offset`)

POST routes use full schemas (all required fields enforced). PATCH routes use `.partial()` variants (all fields optional). String fields have max-length constraints; date fields validate ISO format; enum fields use `z.enum()` referencing existing constants (e.g., `VALID_SCHEDULE`, `VALID_EVENT_TYPES`, `VALID_CATEGORIES`). Database-level foreign key checks remain — Zod validates format, the database validates existence.

### Application-Level Access Control

Data access is enforced at the application layer in the Express backend. Users can only access data within their group. Viewers are restricted to read operations.

### Production Deployment

Production runs via `docker-compose.prod.yml` with 4 services: Traefik, portal, backend, and PostgreSQL.

**Traefik reverse proxy:**

- Auto-discovers services via Docker labels
- Manages SSL certificates via Let's Encrypt HTTP challenge
- Automatically redirects HTTP to HTTPS

**Container setup:**

- Portal and backend are separate Docker images built with multi-stage builds
- PostgreSQL data persisted via named Docker volume
- All containers configured with health checks and `restart: unless-stopped` for reliability
- Backend runs with `init: true` (tini as PID 1) for reliable signal forwarding to the Node.js process
- Backend uses `stop_grace_period: 3s` to reduce Docker's maximum wait from 10s to 3s on shutdown

**Configuration:**

- All runtime configuration via `.env` file (domain, database credentials, JWT secret, SMTP)
- Domain configured via `APP_DOMAIN` env var (default: `care.dnguyen.us`)

**Dev vs production:**

- Dev compose file only runs PostgreSQL — the app runs directly on the host
- Production compose file runs all services in containers

**Environment variables:**

| Variable            | Description               | Example                           |
| ------------------- | ------------------------- | --------------------------------- |
| `APP_DOMAIN`        | Production domain         | `care.dnguyen.us`                 |
| `ACME_EMAIL`        | Email for Let's Encrypt   | `you@example.com`                 |
| `POSTGRES_USER`     | Database username         | `carehub`                         |
| `POSTGRES_PASSWORD` | Database password         | (secret)                          |
| `POSTGRES_DB`       | Database name             | `carehub`                         |
| `JWT_SECRET`        | JWT signing secret        | (secret)                          |
| `SMTP_HOST`         | SMTP server               | `smtp.gmail.com`                  |
| `SMTP_PORT`         | SMTP port                 | `587`                             |
| `SMTP_USER`         | SMTP username             | `carehub.notifications@gmail.com` |
| `SMTP_PASS`         | SMTP app password         | (secret)                          |
| `SMTP_FROM_NAME`    | Email sender display name | `CareHub`                         |

### Kiosk Device Setup

The tablet kiosk requires one-time Device Owner provisioning to enable Lock Task Mode, power button interception, and other system-level kiosk features.

**Prerequisites:**

- Factory-reset tablet (or a tablet with no Google accounts signed in)
- USB cable
- Computer with ADB installed

**Provisioning steps:**

1. Enable Developer Options on the tablet:
   - Go to Settings → About tablet
   - Tap "Build number" 7 times
   - Return to Settings → Developer options
   - Enable "USB debugging"

2. Connect the tablet to a computer via USB and authorize the ADB connection when prompted.

3. Run the Device Owner provisioning command:

   ```bash
   adb shell dpm set-device-owner us.dnguyen.carehub.kiosk/.DeviceAdminReceiver
   ```

4. Verify the command succeeds (output should confirm device owner is set).

5. Disconnect USB cable. The kiosk app now has Device Owner privileges.

**What Device Owner mode enables:**

- Power button dims the screen instead of locking
- Lock Task Mode (app is pinned, cannot exit)
- Keyguard is disabled (no lock screen)
- Auto-restart on app crash
- Persistent foreground service (WebSocket stays alive)

**Important:** Device Owner mode can only be set on a device with no accounts signed in. If the command fails, factory reset the tablet and try again before signing into any Google accounts.

### Testing Strategy

**Backend:** Integration tests using Vitest + Supertest against the Express API and the `ws` package for WebSocket tests. Covers the critical API surface. The `pretest` hook in `packages/backend/package.json` does two things before each test run: (1) rebuilds `@carehub/shared` to prevent stale ESM output; (2) runs `scripts/ensure-test-db.ts`, which idempotently creates `carehub_test` if it doesn't exist — so the database is provisioned correctly on fresh volumes, existing volumes, and CI without any manual steps. `DATABASE_URL_TEST` is read from the shell environment; the default in `src/config/env.ts` (`postgresql://carehub:carehub_dev@localhost:9392/carehub_test`) matches the dev Docker service on port 9392.

**HTTP endpoint tests** cover authentication, devices, profiles, medications, attachments, releases, and health — using Supertest against the Express app.

**WebSocket tests** cover the real-time communication layer — connection authentication (device token, JWT, ticket), client registry (multi-tab support, broadcast, cleanup), device lifecycle (heartbeat, status transitions), and call signaling (initiate, accept, decline, WebRTC exchange, ring timeout). These tests use an actual HTTP server (`server.listen(0)` for random port allocation) with the `ws` package as client. Tests run with `fileParallelism: false` to avoid WebSocket server conflicts.

Test helpers:
- `tests/helpers/ws.ts` — Server creation, WS client connection, message/close waiters, JWT/ticket generation
- `tests/helpers/truncate.ts` — Database table truncation (includes `call_sessions`)
- `tests/factories.ts` — Entity creation helpers (`createUser`, `createDevice`, `createDeviceAccess`, `createDeviceCareProfile`)
- `tests/utils.ts` — Auth cookie generation (`makeAuthCookie`)

**Portal:** Unit and component tests using Vitest with jsdom environment and `@testing-library/svelte`.

- **Vitest config:** `packages/portal/vitest.config.ts` — Svelte 5 compiler plugin, `$lib` path alias, jsdom environment, v8 coverage
- **Test setup:** `packages/portal/vitest-setup.ts` — jest-dom matchers
- **Scripts:** `npm run test` (single run), `npm run test:watch` (watch mode), `npm run test:coverage` (with coverage report)
- **Run from root:** `npm run test:portal`

Test coverage targets business logic and error handling rather than aiming for 100%. `fetch` is mocked for API tests to avoid hitting the backend. Svelte 5 runes (`.svelte.ts` files) are handled by the Svelte compiler plugin; pure logic functions are extracted for testing without Svelte dependency where possible.

Current test files:
- `src/lib/__tests__/api.test.ts` — API client unit tests (request helper, error extraction, 204 handling, query string construction, `isAttachmentProcessing`)
- `src/lib/__tests__/call-helpers.test.ts` — Call helper functions (`getUserFriendlyError`, `formattedDuration`)
- `src/lib/__tests__/error-utils.test.ts` — Error utility functions (`getErrorMessage`, `isRetryable`)
- `src/lib/components/__tests__/DeleteConfirmModal.test.ts` — Delete confirmation modal component
- `src/lib/stores/__tests__/toast.test.ts` — Toast store
