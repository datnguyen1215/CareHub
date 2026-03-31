# Technical Architecture

## Stack

| Layer              | Technology                                                        | Rationale                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package Manager    | npm with workspaces                                               | Monorepo support, standard tooling                                                                                                                                               |
| Frontend           | SvelteKit + Tailwind CSS                                          | SSR + SPA hybrid, mobile-first responsive, fast builds                                                                                                                           |
| Backend/API        | Express + nodemon                                                 | Separate service, clear API boundary, fast dev iteration                                                                                                                         |
| Database           | PostgreSQL via Docker (self-hosted)                               | Relational data, full control, no external dependency                                                                                                                            |
| ORM / Migrations   | Drizzle ORM                                                       | Type-safe queries, SQL-first migrations                                                                                                                                          |
| Auth               | Email + OTP (Nodemailer + Gmail SMTP)                             | Passwordless email login without third-party auth service                                                                                                                        |
| File Storage       | TBD                                                               | To be decided in a future phase                                                                                                                                                  |
| Real-time          | WebSockets (custom)                                               | Tablet push, device status, call signaling                                                                                                                                       |
| Video Calling      | WebRTC (PeerJS or LiveKit)                                        | Peer-to-peer video, minimal server cost                                                                                                                                          |
| Push Notifications | Firebase Cloud Messaging (FCM)                                    | High-priority data messages for call notifications; reliable delivery even when app is closed                                                                                    |
| Native App Shell   | Capacitor                                                         | Wraps SvelteKit web app in native Android shell for both caretaker phones and elderly tablets; enables native push, full-screen call intent, foreground services, lock task mode |
| OTA Updates        | Capgo (self-hosted)                                               | Over-the-air web bundle updates for all Capacitor apps; no manual APK reinstall for UI/logic changes                                                                             |
| OCR/AI             | Google Vision API or AWS Textract                                 | Document text extraction; Tesseract as self-hosted alternative                                                                                                                   |
| Search             | PostgreSQL full-text search                                       | Search over OCR-extracted text, no extra infrastructure                                                                                                                          |
| Hosting            | Self-hosted via Docker — Traefik reverse proxy, Let's Encrypt SSL | Full control, no cloud vendor dependency                                                                                                                                         |
| Testing            | Vitest + Supertest                                                | Integration tests only; no unit or portal tests                                                                                                                                  |
| TypeScript         | Default SvelteKit config                                          | Standard configuration, no custom overrides                                                                                                                                      |
| Linting            | ESLint + Prettier (SvelteKit defaults)                            | Consistent code style with minimal setup                                                                                                                                         |
| Tablet Runtime     | Capacitor APK with Android Lock Task Mode                         | Native app shell prevents exit, auto-restarts on boot, receives FCM push even if backgrounded                                                                                    |

---

## Monorepo Structure

```
packages/
  portal/      # SvelteKit + Tailwind CSS caretaker portal web app
  backend/     # Express API server with WebSocket support
  shared/      # Shared types, utilities, and Drizzle schema
  kiosk/       # SvelteKit elderly tablet kiosk app with Capacitor (Android only)
```

---

## Portal Route Structure

The SvelteKit portal uses a route group `(app)` to wrap all authenticated main pages with a shared layout.

```
src/
  lib/
    TopBar.svelte          # Fixed top bar — "CareHub" branding left, user avatar right
    BottomNav.svelte       # Fixed bottom navigation — Home, Profiles, Devices, Settings tabs
    Toast.svelte           # Toast notification component — displays success/error/destructive messages
    ProfileModal.svelte    # Create/edit care profile modal
    MedicationModal.svelte # Create/edit medication modal — name, dosage, schedule chips, status toggle (edit only)
    EventModal.svelte      # Create/edit event modal — title, date/time, type, location, notes
    DeleteConfirmModal.svelte # Confirmation dialog for deleting events
    api.ts                 # API client with auth cookie handling
    stores/
      toast.ts             # Toast notification store — manage toast queue with auto-dismiss
  routes/
    login/                 # Public auth pages (email entry, OTP verify, account setup)
    (app)/
      +layout.svelte       # Shared layout: TopBar + main content area + BottomNav
      +page.svelte         # Home page — upcoming events list grouped by day with 7/14/30 day range toggle
      profiles/
        +page.svelte       # Profile list — profile card grid
        [id]/
          +page.svelte     # Profile detail — custom top bar, Overview/Meds tabs
      devices/
        +page.svelte       # Device management UI — list, pair, unpair devices
      settings/
        +page.svelte       # Settings — group rename, member management
```

### Shared Layout (`(app)` route group)

All main pages (home, profiles, devices, settings) are wrapped by `src/routes/(app)/+layout.svelte`, which renders:

1. `TopBar` — Fixed top bar with "CareHub" title and user avatar. Avatar fetches `GET /api/users/me` and displays the user's initial. Tapping navigates to `/settings`.
2. `<main>` — Page content with top and bottom padding to clear the fixed bars.
3. `Toast` — Toast notification component positioned above bottom navigation (z-index 40) to display success, error, and destructive messages. Success/destructive toasts auto-dismiss after 3 seconds; error toasts require manual dismissal.
4. `BottomNav` — Fixed bottom navigation with four tabs. Active tab is highlighted with primary blue using the `$page` store. Tabs: Home (`/`), Profiles (`/profiles`), Devices (`/devices`), Settings (`/settings`).

### Profile Detail Page (`/profiles/:id`)

The profile detail page lives inside the `(app)` route group, so the global `TopBar` and `BottomNav` are always rendered by the shared layout. The page additionally renders its own fixed top bar inside `<main>`, which visually replaces the global top bar but stacks a second `h-14` spacer — a known layout issue to be fixed in a future pass (move the route out of `(app)` or suppress the global TopBar on this page). It contains:

1. **Custom top bar** — Back arrow (→ `/profiles`), profile name centered, pencil-icon edit button that opens `ProfileModal`.
2. **Tab bar** — Sticky below the top bar. Two tabs: **Overview** (default) and **Meds**. Active tab is underlined with primary blue.
3. **Overview tab** — Profile info card (name, relationship, date of birth, conditions as badges) and a Recent Medications card (top 3 active meds, "See all" link switching to Meds tab, empty state).
4. **Meds tab** — Full medication management: add/edit/discontinue medications via `MedicationModal`, with a "Show discontinued" toggle.

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
- Connection authenticated via device_token query parameter
- Server tracks connected devices in memory (Map<deviceId, WebSocket>)
- Ping/pong for connection health (30s interval)
- Updates `last_seen_at` and `status` on connect/disconnect

**Events (Server → Kiosk):**

- `device_paired` - Pairing completed, includes assigned profiles
- `device_revoked` - Device unpaired, kiosk should clear data
- `profiles_updated` - Profile assignments changed
- `incoming_call` - Caretaker initiating video call (Phase 3.5)
- `call_ended` - Call terminated (Phase 3.5)

**Events (Kiosk → Server):**

- `heartbeat` - Periodic ping with battery level
- `status_update` - Online/offline state changes
- `call_request` - Elderly initiating call to caretaker (Phase 3.5)

**Portal WebSocket Integration:**

Portal WebSocket integration is deferred to Phase 3.5. The backend WebSocket endpoint (`/ws`) currently only accepts device token authentication for kiosk connections, not user session authentication required for portal connections. Device status updates in the portal currently require page refresh.

### Peer-to-Peer Video

Video calls use WebRTC for direct peer-to-peer connections, avoiding the cost and complexity of a media server. STUN servers handle NAT traversal. A TURN relay serves as fallback when direct connection fails.

### Capacitor Native Apps

Both the caretaker phone app and the elderly tablet kiosk are Capacitor APKs built from the same SvelteKit codebase. Each uses a different entry point (caretaker portal vs. kiosk UI) but shares all underlying code.

**Caretaker phone app enables:**

- **Native push notifications via FCM** -- High-priority data messages wake the device and bypass Doze mode, ensuring call notifications are delivered even when the app is closed or the screen is off.
- **Full-screen call intent** -- Incoming calls display a native full-screen notification over the lock screen (using Android's `fullScreenIntent`), identical to how WhatsApp or a regular phone call behaves. Shows caller name, photo, and large Accept/Decline buttons.
- **Foreground service** -- Keeps the WebRTC connection alive during active calls so Android does not kill the process.

**Tablet kiosk app enables:**

- **Lock Task Mode** -- Android API that pins the app to the screen. The elderly user cannot exit to the home screen, open the notification shade, or switch apps. This is what commercial kiosk devices use.
- **Auto-restart on boot** -- App launches automatically when the tablet powers on (e.g., after a power outage or reboot).
- **Foreground service** -- Keeps the WebSocket connection alive so the tablet is always reachable for incoming calls and content pushes.
- **FCM fallback** -- If the foreground service is killed by Android, a high-priority FCM message can wake the app back up for incoming calls.

**No separate codebase** -- The entire UI remains Svelte 5 running in a web view. Capacitor only provides the native bridge for push notifications, call UI, kiosk lock-down, and background services.

### Over-the-Air Updates (Capgo)

All Capacitor apps (caretaker phones and elderly tablets) receive UI and logic updates over-the-air via Capgo (self-hosted). This avoids manually sideloading a new APK for every change.

- App checks for updates periodically (e.g., every hour) or on launch.
- New web bundles are downloaded silently in the background.
- Updates apply on next app restart -- no user interaction required.
- APK rebuild is only needed when native plugins or Capacitor configuration change (rare after initial setup).
- Elderly tablets update automatically with zero intervention.

### Push Notification Flow (Incoming Calls)

1. Elderly family member taps a caretaker's photo on the tablet kiosk app.
2. Tablet app sends a call request to the server via WebSocket (kept alive by foreground service).
3. Server sends a **high-priority FCM data message** to the caretaker's device, containing caller name, photo URL, and call session ID.
4. Capacitor FCM plugin receives the message and triggers a **full-screen incoming call notification** with ringtone and vibration.
5. Caretaker taps Accept -- app opens (or foregrounds) and WebRTC call connects.
6. If the caretaker does not answer within a timeout, the tablet shows a "no answer" state.

### OCR at Upload Time

Documents are processed through OCR immediately on upload. The extracted text is stored in the `ocr_text` column and indexed with PostgreSQL full-text search. This avoids runtime processing delays during search and keeps the search infrastructure simple.

### QR Pairing with Expiring Tokens

Tablet pairing uses a one-time token with a 5-minute expiry. The tablet displays the token as a QR code. The caretaker scans it with their phone camera from the portal. This avoids manual code entry and prevents stale pairing sessions.

**Pairing Flow:**

1. Kiosk calls `POST /api/devices/register` to create device record and get device_token
2. Kiosk calls `POST /api/devices/pairing-token` to generate QR token (5-min expiry)
3. Kiosk displays QR code and auto-refreshes every 4 minutes
4. Caretaker scans QR from portal and calls `POST /api/devices/pair` with token
5. Server sends `device_paired` event via WebSocket
6. Kiosk stores device_token and navigates to home screen

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

| Method   | Path                                                       | Auth        | Description                                                                                             |
| -------- | ---------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/auth/email`                                          | Public      | Send OTP to email address                                                                               |
| `POST`   | `/api/auth/verify`                                         | Public      | Verify OTP; issues JWT httpOnly cookie                                                                  |
| `PATCH`  | `/api/users/me`                                            | Required    | Update authenticated user's first and last name                                                         |
| `POST`   | `/api/groups`                                              | Required    | Create a group; creator is added as admin                                                               |
| `PATCH`  | `/api/groups/:id`                                          | Required    | Rename a group (admin only)                                                                             |
| `GET`    | `/api/groups`                                              | Required    | Return all groups the authenticated user belongs to                                                     |
| `POST`   | `/api/groups/:groupId/profiles`                            | Admin only  | Create a care profile; `name` required                                                                  |
| `GET`    | `/api/groups/:groupId/profiles`                            | Member only | List all care profiles in the group                                                                     |
| `GET`    | `/api/groups/:groupId/profiles/:id`                        | Member only | Get a single care profile                                                                               |
| `PATCH`  | `/api/groups/:groupId/profiles/:id`                        | Admin only  | Partial update of any care profile field                                                                |
| `DELETE` | `/api/groups/:groupId/profiles/:id`                        | Admin only  | Delete a care profile                                                                                   |
| `POST`   | `/api/groups/:groupId/profiles/:profileId/medications`     | Member only | Create a medication; `name` required; optional: `dosage`, `schedule`, `status`                          |
| `GET`    | `/api/groups/:groupId/profiles/:profileId/medications`     | Member only | List medications; active only by default; add `?include_discontinued=true` to include discontinued ones |
| `PATCH`  | `/api/groups/:groupId/profiles/:profileId/medications/:id` | Member only | Partial update of any medication field; use `status: "discontinued"` to discontinue                     |
| `DELETE` | `/api/groups/:groupId/profiles/:profileId/medications/:id` | Member only | Hard delete a medication                                                                                |
| `GET`    | `/api/health`                                              | Public      | Health check — returns `{ status: "ok" }`; used by Traefik and Docker health checks                     |
| `POST`   | `/api/devices/register`                                    | Public      | Register new device; returns device_token                                                               |
| `GET`    | `/api/devices/me`                                          | Device Auth | Validate device token; returns device info with assigned profiles                                       |
| `POST`   | `/api/devices/pairing-token`                               | Device Auth | Generate QR pairing token (5-min expiry)                                                                |
| `GET`    | `/api/devices/pairing-status`                              | Device Auth | Poll for pairing completion                                                                             |
| `GET`    | `/api/devices`                                             | Required    | List devices user has access to                                                                         |
| `POST`   | `/api/devices/pair`                                        | Required    | Complete pairing by scanning QR token; link device to profiles                                          |
| `GET`    | `/api/devices/:id`                                         | Required    | Get device details (requires access)                                                                    |
| `PATCH`  | `/api/devices/:id`                                         | Required    | Update device name                                                                                      |
| `DELETE` | `/api/devices/:id`                                         | Required    | Unpair/remove device                                                                                    |
| `POST`   | `/api/devices/:id/profiles`                                | Required    | Assign profiles to device                                                                               |
| `DELETE` | `/api/devices/:id/profiles/:profileId`                     | Required    | Remove profile from device                                                                              |

**SMTP configuration via environment variables:**

| Variable         | Description                   |
| ---------------- | ----------------------------- |
| `SMTP_HOST`      | SMTP server hostname          |
| `SMTP_PORT`      | SMTP server port              |
| `SMTP_USER`      | SMTP username / email address |
| `SMTP_PASS`      | SMTP password or app password |
| `SMTP_FROM_NAME` | Display name for sent emails  |

A dedicated Gmail account is recommended for sending OTP emails.

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

### Testing Strategy

Integration tests only, using Vitest + Supertest against the Express API. No unit tests or portal component tests. This keeps the test suite lean while covering the critical API surface.
