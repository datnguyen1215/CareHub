# Feature Specification

Detailed feature breakdown organized by area. See [phases.md](phases.md) for implementation order.

---

## Authentication and Access

### Login

- Email + OTP authentication (passwordless, delivered via Nodemailer + Gmail SMTP)
- No password required; 6-digit OTP expires after 15 minutes
- JWT issued on successful verification, stored in an httpOnly cookie with no expiration
- First-time login creates a User record, redirects to `/login/setup` for name entry, then auto-creates a default group named "My Family" (user is assigned admin role) before landing on the dashboard

### Invitations

- Email-based invitation system for adding new viewers
- Invite link contains role assignment (Viewer by default)
- Invited users authenticate via OTP on first visit

### Roles

| Role   | Create | Read | Update | Delete | Manage Devices |
| ------ | ------ | ---- | ------ | ------ | -------------- |
| Admin  | Yes    | Yes  | Yes    | Yes    | Yes            |
| Viewer | No     | Yes  | No     | No     | No             |

### Shared Access

- Multiple admins per group (e.g., both caretakers)
- All admins share full access to all profiles within the group
- Viewers see all profiles they are granted access to

---

## Care Profiles

### Health Dashboard

- Per-person profile with avatar and basic info (name, age, relationship)
- Known conditions

### Profile List Page

- All profiles visible on dedicated profiles page (`/profiles`) as full-width horizontal rows
- Each row shows: avatar (left), info section (name, relationship · medication count, device name + status, condition badges), chevron (right)
- Device status shown inline with device name: 📱 Device Name with green dot (online) or gray dot (offline); no indicator if no devices assigned
- Tap a row to navigate to `/profiles/:id` (profile detail)
- "Add Profile" button in header when profiles exist; empty state with icon and "Add your first care profile" CTA when no profiles exist
- Top bar: "CareHub" branding left, user avatar/initial right (navigates to settings)
- Bottom navigation: Home (home at `/`), Profiles, Devices, Settings tabs

### Profile Detail - Device Quick Actions

- Device card displayed in Profile Overview tab for linked devices
- Shows device name, online/offline status dot, battery level indicator
- Quick action buttons: Send Photo, Call (both disabled when offline), Settings
- Multiple devices supported (cards stack vertically)
- Empty state with "+ Link Device" CTA when no device assigned

---

## Medication Management

### Medication List

- Per-profile flat medication list
- Fields: name, dosage, schedule (multi-select: morning/afternoon/evening/bedtime), status (active/discontinued)
- Inline dosage and schedule badges on each row
- Active medications shown by default; discontinued medications hidden behind a "Show discontinued" toggle
- Tap any medication to edit or delete via modal
- Add new medication via modal

### Future: Medication Reminders

- Push notifications to caretaker devices
- Schedule display on tablet kiosk

---

## Home Page (Upcoming Events)

### Event List View

- Upcoming events grouped by day (Today, Tomorrow, then date labels)
- Sorted by time within each day
- Shows all profiles' events combined
- Configurable range toggle: 7 days (default), 14 days, 30 days

### Event Display

- Each event card shows: profile photo + name, event title, time, type indicator (color-coded)
- Event types: doctor visit, lab work, therapy, general appointment
- Color-coded event types: blue (doctor visit), purple (lab work), green (therapy), gray (general)
- Fields: title, date/time, location, notes, linked profile
- Events linkable to journal entries
- Empty state: "No upcoming events" with CTA to add one
- Attach documents to events (pre-visit records, results, etc.)
- Recurring event support (future)

---

## Journals and Notes

### Journal Entries

- Free-form text entries tied to a date
- Star entries to mark important notes
- Attach documents and photos to entries

### Search

- Full-text search across all journal entries
- Filter by profile or date range

---

## Attachments

### Upload and Storage

- Camera capture for paper documents (mobile photo upload)
- File upload for digital documents (PDF, images)
- Attachments belong to a care profile
- Attachments can be linked to journal entries or calendar events
- Attach documents when creating or editing journals and events

### AI Processing

- OCR text extraction at upload time (Google Vision API)
- Auto-generated descriptions based on OCR content
- Auto-categorization: lab results, prescriptions, insurance, billing, imaging, other
- Extracted text stored for full-text search

### Documents Tab

- Search/browse view across all attachments for a profile
- Full-text search across OCR-extracted text and descriptions
- Filter by category and date range
- View attachment details with parent context (linked journal or event)

### Future: AI Summarization

- Health history summaries generated from accumulated attachments
- Trend detection across lab results

---

## Device Management

### Tablet Registration

- Register Android tablets as managed devices
- Each device gets a unique device_token for authentication
- Tablet runs as web app in browser (Capacitor APK wrapper planned)
- Device metadata: name, assigned profiles, status, battery, last seen
- Remote unpair clears device data and returns to pairing screen

### QR-Based Pairing

- Kiosk generates one-time pairing token (5-minute expiry)
- Kiosk displays QR code on pairing screen with auto-refresh
- Caretaker scans QR from portal device management page using html5-qrcode library
- Fallback to manual 8-character code entry if camera access denied
- 3-step pairing wizard: Scan QR → Select Profiles → Name Device
- Caretaker selects which profiles to assign during pairing
- Device name editable (defaults to "New Tablet")
- Confirmation completes pairing; kiosk receives notification via WebSocket
- Success screen with auto-redirect to device list
- Kiosk stores device_token securely and navigates to home screen

### Device Status

- Online/offline indicator (real-time via WebSocket)
- Green dot = online, gray dot = offline
- Battery level with visual progress bar (color-coded: green > 50%, yellow 20-50%, red < 20%)
- Last seen timestamp (relative time display: "Just now", "5m ago", "2h ago", etc.)
- Device name (editable inline with pencil icon)
- Assigned profiles list with avatars

### Access Control

- Multiple devices per profile, multiple profiles per device
- Caretakers with device access can manage profiles and unpair
- Device token authentication separate from user JWT authentication
- Remote unpair sends `device_revoked` event to clear kiosk data

---

## Tablet Kiosk Mode

### Runtime

- SvelteKit web app running in browser (Capacitor APK wrapper planned for Phase 3.5)
- Persistent WebSocket connection for real-time features
- Auto-reconnect on network interruption
- Device token stored securely (localStorage for now, Capacitor Secure Storage when native)
- Offline state shows cached data with "Reconnecting..." indicator

### Design Principles

- Minimum 80px touch targets for all interactive elements (Tailwind `unit-10` = 80px)
- No text input required anywhere -- everything is tap-based
- Maximum 2-3 taps for any action
- Large font sizes (base 20px, headings 32-48px)
- High contrast colors for visibility
- Personalized greeting with current time and date

### Pairing Screen

- Large centered QR code display
- Auto-refreshes token every 4 minutes (before 5-min expiry)
- Listens for `device_paired` WebSocket event
- On paired: stores device_token and navigates to home

### Home Screen

- Displays if multiple profiles assigned
- Large profile cards with photos and names
- Greeting and current time/date display
- Tap profile card to navigate to profile dashboard

### Profile Dashboard

- Shows if single profile or after selecting from home
- Back button to home (if multiple profiles)
- Personalized greeting ("Good morning, [Name]!")
- Current time and date
- Large caretaker cards (all group members with profile access)
- Today's appointments list
- Tap caretaker card to initiate call (Phase 3.5)

### Connection Status

- Subtle online/offline indicator
- Shows "Reconnecting..." when WebSocket disconnected
- Auto-reconnects with exponential backoff

---

## Remote Tablet Control

- Manage device from portal: rename, assign/remove profiles, unpair
- View device status: online/offline, battery level, last seen
- Profile updates pushed to kiosk via `profiles_updated` WebSocket event
- Remote unpair sends `device_revoked` event to clear kiosk data
- Video calling (Phase 3.5)
- Content push: photos, appointments, messages (Phase 4)

---

## Video Calling

### Technology

- WebRTC peer-to-peer video
- Signaling via WebSocket server (call:incoming, call:offer, call:ice-candidate, call:ended, call:error messages)
- ICE/STUN/TURN for NAT traversal
- Firebase Cloud Messaging (FCM) for call notifications to caretaker devices
- Capacitor native shell on both caretaker phones and elderly tablets
- Kiosk call state management via Svelte 5 runes with race condition guards

### Capabilities

- Caretaker initiates call to tablet from portal (phone or desktop)
- Elderly family member initiates call from tablet by tapping caretaker photo
- Full-screen video display on tablet
- Audio and video with microphone/camera permissions (720p ideal, echo cancellation, noise suppression)
- **Native incoming call UI on caretaker phone** -- full-screen notification over lock screen with ringtone, vibration, caller photo, and Accept/Decline buttons (same behavior as WhatsApp or a phone call)
- Missed call handling with "no answer" state on tablet
- Call duration timer displayed during active calls
- Graceful handling of camera permission delays and call cancellations

### Reliability

- Auto-reconnect on connection drop
- Fallback through TURN relay if direct peer connection fails
- Connection quality indicator
- High-priority FCM ensures notifications delivered even when app is closed or device is in Doze mode
- Foreground service keeps active calls alive on both caretaker phone and tablet
- Tablet Lock Task Mode prevents accidental exit during or between calls
