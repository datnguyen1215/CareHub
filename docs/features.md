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

### Home Dashboard

- All profiles visible from home screen as cards
- Each card shows: name, relationship, conditions (tags), active medication count
- Tap to enter full profile detail

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

## Calendar

### Monthly View

- Calendar grid with event indicator dots
- Filter by profile or view all

### Events

- Event types: doctor visit, lab work, therapy, general appointment
- Fields: title, date/time, location, notes, linked profile
- Events linkable to journal entries
- Recurring event support (future)

---

## Journals and Notes

### Journal Entries

- Free-form text entries tied to a date
- Optional link to a calendar event (e.g., post-visit notes)
- Key takeaways field for quick scanning
- Attached documents and photos

### Search

- Full-text search across all journal entries
- Filter by profile, date range, or linked event

---

## Document Storage with AI

### Upload

- Camera capture for paper documents (mobile photo upload)
- File upload for digital documents (PDF, images)
- Documents assigned to a care profile

### AI Processing

- OCR text extraction at upload time (Google Vision API, AWS Textract, or Tesseract)
- Extracted text stored alongside document for search
- Auto-categorization: lab results, prescriptions, insurance, billing, imaging, other

### Organization

- Manual tags and categories
- Documents linkable to calendar events and journal entries
- Chronological and categorical browsing

### Search

- Full-text search across all OCR-extracted text
- Filter by category, profile, date range

### Future: AI Summarization

- Health history summaries generated from accumulated documents
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
