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

- All profiles visible on dedicated profiles page (`/profiles`) as cards
- Each card shows: name, relationship (subtitle), conditions (tags, max 3 + overflow count), active medication count
- Tap a card to navigate to `/profiles/:id` (profile detail)
- "Add Profile" button in header when profiles exist; empty state with icon and "Add your first care profile" CTA when no profiles exist
- Top bar: "CareHub" branding left, user avatar/initial right (navigates to settings)
- Bottom navigation: Home (home at `/`), Profiles, Devices (Coming Soon), Settings tabs

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
- Tablet runs Capacitor APK with Lock Task Mode and auto-boot
- Over-the-air updates via Capgo (no manual APK reinstall for UI/logic changes)
- Device metadata: name, assigned profiles, status

### QR-Based Pairing

- Portal initiates pairing session, generating a one-time token (5-minute expiry)
- Tablet displays QR code on its pairing screen
- Caretaker scans QR with phone camera
- Caretaker selects which profiles to assign
- Confirmation completes pairing; tablet enters kiosk mode

### Device Status

- Online/offline indicator
- Battery level
- Last seen timestamp
- Real-time status via WebSocket connection

### Access Control

- Multiple tablets per profile, multiple profiles per tablet
- Share device access with other caretakers via email
- Remote unpair from portal

---

## Tablet Kiosk Mode

### Runtime

- Capacitor APK with Android Lock Task Mode -- user cannot exit the app, access home screen, or open notification shade
- Auto-launch on device boot -- app starts automatically after power on or reboot
- Foreground service keeps WebSocket connection alive for incoming calls and content pushes
- FCM fallback wakes app if foreground service is killed
- Over-the-air updates via Capgo -- UI/logic updates applied automatically, no manual APK reinstall

### Design Principles

- Minimum 80px touch targets for all interactive elements
- No text input required anywhere -- everything is tap-based
- Maximum 2-3 taps for any action
- Auto-reconnect on network interruption
- Personalized greeting with current time and date

### Home Screen

- Large caretaker cards with photos for one-tap video calling
- Today's schedule/appointments (pushed from portal)
- Shared content area (photos, messages from family)

### Incoming Calls

- Full-screen incoming call display
- Large Accept and Decline buttons
- Caller name and photo prominently displayed

### Content Display

- Photos and messages pushed by caretakers
- Appointment reminders
- Rotating family photo slideshow (future)

---

## Remote Tablet Control

- Push content to tablet from portal: photos, appointments, messages
- Initiate video call to tablet from portal
- Adjust display settings remotely (brightness, content rotation)
- Show specific content on demand

---

## Video Calling

### Technology

- WebRTC peer-to-peer video
- Signaling via WebSocket server
- ICE/STUN/TURN for NAT traversal
- Firebase Cloud Messaging (FCM) for call notifications to caretaker devices
- Capacitor native shell on both caretaker phones and elderly tablets

### Capabilities

- Caretaker initiates call to tablet from portal (phone or desktop)
- Elderly family member initiates call from tablet by tapping caretaker photo
- Full-screen video display on tablet
- Audio and video with microphone/camera permissions
- **Native incoming call UI on caretaker phone** -- full-screen notification over lock screen with ringtone, vibration, caller photo, and Accept/Decline buttons (same behavior as WhatsApp or a phone call)
- Missed call handling with "no answer" state on tablet

### Reliability

- Auto-reconnect on connection drop
- Fallback through TURN relay if direct peer connection fails
- Connection quality indicator
- High-priority FCM ensures notifications delivered even when app is closed or device is in Doze mode
- Foreground service keeps active calls alive on both caretaker phone and tablet
- Tablet Lock Task Mode prevents accidental exit during or between calls
