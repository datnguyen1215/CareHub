# User Flows

Step-by-step workflows for core tasks. Wireframe references point to files in `designs/`.

---

## 1. First-Time Setup

**Actor:** New caretaker (Admin)

1. Navigate to CareHub login page (`designs/01-login.svg`)
2. Enter email address and tap "Send Code"
3. Receive 6-digit OTP via email (`designs/01b-otp-verify.svg`)
4. Enter OTP to verify; JWT cookie is set on success
5. Prompted to enter first and last name (`designs/01c-account-setup.svg`)
6. On submit: profile is saved, a default group named "My Family" is created automatically (no user prompt), welcome toast displays "Welcome to CareHub!", and the user is redirected to `/` (Home page showing upcoming events)
7. Navigate to Profiles tab to add first care profile: enter name, relationship, date of birth, photo
8. Fill in initial health info: known conditions, current medications, notes
9. Profile card appears on the profiles page (`designs/02-home-dashboard.svg`)

---

## 2. Managing Care Profiles

**Actor:** Caretaker (Admin)

### Create a profile

1. From the Profiles tab, tap "Add Profile"
2. A modal dialog opens over the profiles page
3. Fill in the form: Name (required), Date of Birth (optional date picker), Relationship (optional text — e.g., grandmother, father), Conditions (optional comma-separated tags)
4. Tap Save; the new profile card appears on the profiles page immediately
5. Success toast displays: "[Name] created"

### Edit a profile

From the profiles page:

1. On any profile card, tap "Edit"
2. The same modal opens pre-filled with existing values
3. Modify any field and tap Save; the card updates in place
4. Success toast displays: "Profile saved"

From the profile detail page (`/profiles/:id`):

1. Tap the pencil icon in the top bar
2. The same edit modal opens pre-filled with existing values
3. Modify any field and tap Save; the top bar name and profile card update in place
4. Success toast displays: "Profile saved"

### Delete a profile

1. On any profile card on the profiles page, tap "Delete"
2. A confirmation dialog opens: "Are you sure you want to remove [name]?"
3. Tap the danger-red Delete button to confirm; profile card is removed from the profiles page
4. Destructive toast displays: "Profile deleted"

---

## 3. Adding a Medication

**Actor:** Caretaker (Admin)

1. From the profiles page, tap a profile card (`designs/02-home-dashboard.svg`)
2. Profile detail opens (`designs/03-profile-detail.svg`)
3. Tap the Medications tab (`designs/04-medications.svg`)
4. Tap "Add Medication" button
5. Modal opens; fill form: name, dosage, schedule (multi-select: morning/afternoon/evening/bedtime), status (active/discontinued)
6. Tap Save
7. Medication appears in the active list with inline dosage and schedule badges
8. Success toast displays: "[Medication name] added"

---

## 4. Doctor Visit Workflow

**Actor:** Caretaker (Admin), at a doctor's office

1. Doctor provides paper documents (lab results, prescriptions)
2. Open CareHub on phone, navigate to Home tab
3. Tap "+ Add Event" button (or tap an existing event to edit)
4. Create a calendar event for the visit (date, doctor name, location, event type)
5. Success toast displays: "Event added"
6. Navigate to the profile and tap Journal tab (`designs/06-journal-entry.svg`)
7. Tap "+ Add" to create a new journal entry (`designs/06c-journal-modal.svg`)
8. Enter title (e.g., "Post-Visit Notes"), select the date
9. Use the "Link to Event" dropdown to connect the entry to the calendar event
10. Write key takeaways in bullet form for quick reference
11. Write detailed notes in the Notes field
12. Optionally star the entry for quick access
13. Tap Save; entry appears in the journal list
14. Success toast displays: "Entry saved"
15. All related data is now connected: event and journal entry

---

## 5. Device Pairing Flow

**Actor:** Caretaker (Admin), with physical access to the tablet

### Tablet Setup

1. Navigate to kiosk URL in tablet browser (e.g., `http://kiosk.carehub.local:9393`)
2. Kiosk app launches and checks for device_token in storage
3. No token found → navigates to `/pairing` screen
4. Kiosk calls `POST /api/devices/register` to create device record
5. Kiosk calls `POST /api/devices/pairing-token` to generate QR token
6. Large QR code displays centered on screen
7. Token auto-refreshes every 4 minutes (before 5-min expiry)
8. Instructions: "Scan this code from your CareHub portal"

### Portal Pairing (3-Step Wizard)

9. On phone/computer: navigate to Devices tab in portal
10. Tap "+ Pair New Tablet" button (dashed border style)
11. **Step 1 - Scan QR:**
    - QR scanner opens using html5-qrcode library with camera viewfinder
    - Corner bracket overlay guides the user
    - On successful scan: haptic feedback, auto-advance to Step 2
    - Fallback: "Enter code manually" link opens 8-character input if camera denied
12. **Step 2 - Select Profiles:**
    - Checkbox list of all profiles in the group
    - At least one profile must be selected
    - Tap "Continue" to advance
13. **Step 3 - Confirm & Name:**
    - Device name input (pre-filled "New Tablet", editable)
    - Summary of selected profiles shown
    - Tap "Pair Device" to complete
14. Portal calls `POST /api/devices/pair` with token and profile IDs
15. If device name changed, portal calls `PATCH /api/devices/:id` to update name

### Completion

16. Server validates token, checks actual WebSocket connection status, updates device with correct online/offline status, assigns profiles, and grants access
17. Server sends `device_paired` WebSocket event to kiosk
18. Portal shows success screen with checkmark animation
19. Auto-redirect to devices list after 2 seconds (or tap "Go to Devices")
20. Kiosk stores device_token securely
21. Kiosk navigates to `/home` (or `/profile/[id]` if single profile)
22. Device appears in portal device list with accurate status (online if WebSocket connected, offline if not)
23. Kiosk displays home screen with assigned profile cards

---

## 6. Calling Grandparent from Portal

**Actor:** Caretaker (Admin or Viewer)

**From the devices list (`/devices`):**

1. Navigate to the Devices section via bottom navigation (`designs/09-devices.svg`)
2. Device cards show status (online/offline), name, and type
3. Tap the "Call" button on an online device card
4. CallModal opens showing device name and "Calling…" status with animated dots
5. After connection, mute and video toggle buttons become available
6. Either party can end the call via the red end-call button

**From the profile detail page (`/profiles/:id`):**

1. From home dashboard, tap the grandparent's profile card
2. On profile detail page, tap "Call Tablet" button
3. Portal requests microphone and camera permissions (first time only)
4. WebRTC signaling initiates; call request sent to tablet via WebSocket (or FCM if WebSocket is disconnected)
5. Tablet app displays incoming call screen with caretaker's name and photo (`designs/12-tablet-incoming-call.svg`)
6. Grandparent taps the large Accept button
7. Video call connects; both sides see and hear each other
8. During the call, the caretaker can share their screen; the kiosk automatically switches to screen share display mode (`object-fit: contain`, light gray background) and shows a "Screen shared by [name]" indicator
9. When screen sharing stops, the kiosk returns to normal video layout
10. Either party can end the call

**If the call is not answered (ring timeout):**

1. After 30 seconds of ringing with no answer, the server ends the session
2. Both the portal and the tablet receive a `call:ended` message with reason `missed`
3. Portal shows a "No answer" indication and closes the call UI
4. Tablet returns to idle state, clearing the incoming call screen
5. The tablet is immediately available to receive new calls

---

## 7. Kiosk Navigation Flow

## 8. Grandparent Calling Caretaker

**Actor:** Elderly family member (Tablet user)

### After Pairing

1. Kiosk navigates to `/home` if multiple profiles assigned
2. Large greeting displays: "Good morning!" with current time and date
3. Profile cards show photos and names
4. Tap a profile card → navigate to `/profile/[id]`

### Single Profile

- If only one profile assigned, kiosk redirects directly to `/profile/[id]`
- No profile selection needed

### Profile Dashboard

5. Profile dashboard shows:
   - Personalized greeting: "Good morning, [Name]!"
   - Current time and date
   - Large caretaker photo cards (all group members)
   - Today's appointments section
6. Tap caretaker card → (will initiate call in Phase 3.5)
7. Back button (if multiple profiles) → return to `/home`

### Remote Unpair

8. When caretaker unpairs device from portal
9. Server sends `device_revoked` WebSocket event
10. Kiosk clears all stored data (device_token, profiles)
11. Kiosk navigates back to `/pairing` screen
12. Ready for re-pairing

---

## 9. Managing Devices from Portal

**Actor:** Caretaker (Admin or Viewer)

### View Devices

1. Navigate to Devices tab in portal
2. Device list shows all paired devices with:
   - Device name
   - Online/offline status (real-time via WebSocket)
   - Battery level
   - Last seen timestamp
   - Assigned profiles count

### Rename Device

3. Tap device name or edit icon
4. Enter new name (e.g., "Living Room Tablet")
5. Tap Save
6. Device name updates in list

### Manage Profiles

7. Tap device to view details
8. See list of assigned profiles
9. Tap "Assign Profiles" to add more
10. Select profiles from dropdown
11. Tap "Remove" on a profile to unassign
12. Changes pushed to kiosk via `profiles_updated` WebSocket event
13. Kiosk updates home screen profile cards immediately

### Unpair Device

14. Tap device to view details
15. Tap "Unpair Device" button
16. Confirmation dialog: "Are you sure?"
17. Tap "Unpair" to confirm
18. Server sends `device_revoked` event to kiosk
19. Device removed from portal list
20. Kiosk clears data and returns to pairing screen

---

## 10. Inviting a New Viewer

**Actor:** Caretaker (Admin)

1. Navigate to Settings in portal
2. Tap "Invite Member"
3. Enter the person's email address
4. Select role: Viewer (read-only access)
5. Tap Send Invite
6. System sends email invitation with a login link
7. New user navigates to login, enters email, completes OTP verification, and lands on the Home page
8. Viewer can navigate to Profiles tab to see all household profiles in read-only mode

---

## 11. Searching Attachments

**Actor:** Caretaker (Admin or Viewer)

1. Navigate to a profile's Documents tab (`designs/07-documents.svg`)
2. Tap the search bar
3. Type a search term (e.g., "cholesterol")
4. PostgreSQL full-text search queries the OCR-extracted text across all attachments for this profile
5. Results display matching attachments with highlighted excerpts and parent context (linked journal or event, if any)
6. Tap a result to view the full attachment detail (`designs/08-document-detail.svg`)
7. Original image and extracted text displayed side by side, with link to parent journal entry or event if applicable

---

## 12. Creating a Journal Entry

**Actor:** Caretaker (Admin)

1. From the Profiles tab, tap a profile card
2. Profile detail opens with tabs: Overview, Meds, Calendar, Journal, Docs (`designs/03-profile-detail.svg`)
3. Tap the Journal tab (`designs/06-journal-entry.svg`)
4. Tap "+ Add" button
5. Modal opens (`designs/06c-journal-modal.svg`)
6. Fill in: Title (required), Date (defaults to today), Link to Event (optional dropdown of existing events), Key Takeaways (optional), Notes (required)
7. Optionally tap "Star this entry" to mark for quick access
8. Tap Save
9. Entry appears in the journal list, sorted by date
10. Success toast displays: "Entry saved"

---

## 13. Searching Journal Entries

**Actor:** Caretaker (Admin or Viewer)

1. Navigate to a profile's Journal tab (`designs/06-journal-entry.svg`)
2. Tap the search bar at the top
3. Type a search term (e.g., "blood pressure")
4. PostgreSQL full-text search queries title, content, and key takeaways
5. Results update in real-time as you type (debounced)
6. Tap a result to view the full entry (`designs/06b-journal-detail.svg`)
7. If the entry is linked to a calendar event, tap the link to navigate to the Calendar tab

---

## 14. Viewing Linked Journal from Event

**Actor:** Caretaker (Admin or Viewer)

1. From the Home tab, tap an event card to view details
2. Event details show full information including title, date/time, type, location, notes, and profile
3. If journal entries are linked to this event, they appear in a "Linked Journal" section
4. Tap a linked journal entry to view its full content
5. Cross-linking allows navigating between events and their related notes

---

## 15. Calling from Device Detail

**Actor:** Caretaker (Admin)

1. From the Devices tab, tap a device card to view device detail page
2. Device detail page displays device name, online/offline status, battery level
3. If device is online, tap "📞 Call" button to initiate a video call
4. Portal WebSocket sends `call:initiate` message to backend
5. Local camera/microphone permission prompt appears (first time only)
6. Full-screen CallModal appears with call status
7. Call state machine transitions: idle → initiating → signaling.waitingForAccept (ringing)
8. CallModal shows "Calling {deviceName}..." with animated spinner during initiating
9. CallModal shows "Ringing..." during signaling.waitingForAccept state
10. Backend forwards signaling to device via WebSocket
11. Device accepts call → Portal state machine transitions to signaling.creatingOffer and creates SDP offer
12. After offer sent, state transitions to signaling.exchangingIce then connecting
13. CallModal shows "Connecting..." during connecting state while ICE negotiation occurs
14. If ICE connection is not established within 15 seconds, state machine transitions to failed with error "Could not connect. Please check your network and try again." and a retry option
15. ICE connection established → State machine transitions to connected
16. CallModal displays remote video stream from device (full screen) and local video preview (picture-in-picture corner)
17. Controls available: mute/unmute audio (M key), toggle video (V key), end call (Escape key)
18. Call duration counter displays in MM:SS format in status bar
19. If network blips occur (WiFi handoff, momentary packet loss), ICE enters disconnected state but call does not immediately fail; a 10-second reconnect timer starts and the call recovers if ICE reconnects
20. If the network interruption exceeds 10 seconds, the call transitions to failed with a "disconnected" error
21. Tap "End Call" button or press Escape → State machine transitions to ending, WebSocket sends `call:ended`, connection closes, modal closes
20. If call fails or is declined, state transitions to failed, error message displays with "Try Again" (if retryable) or "Close" button
21. If device is offline, Call button is disabled (grayed out)
22. If a call is already in progress, Call button is disabled
23. Alternative from profile detail: tap "📞 Call" on device card in Profile Overview tab to initiate call
24. During the call, the caretaker can share their screen; the kiosk switches to screen share display mode (full document visible, light gray background) with a "Screen shared by [name]" indicator; stopping screen share returns to normal video layout
