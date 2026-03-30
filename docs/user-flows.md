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
6. On submit: profile is saved, a default group named "My Family" is created automatically (no user prompt), and the user is redirected to `/`
7. Add first care profile: enter name, relationship, date of birth, photo
8. Fill in initial health info: known conditions, current medications, notes
9. Land on home dashboard with the new profile card (`designs/02-home-dashboard.svg`)

---

## 2. Managing Care Profiles

**Actor:** Caretaker (Admin)

### Create a profile

1. From the home dashboard, tap "Add Profile"
2. A modal dialog opens over the dashboard
3. Fill in the form: Name (required), Date of Birth (optional date picker), Relationship (optional text — e.g., grandmother, father), Conditions (optional comma-separated tags)
4. Tap Save; the new profile card appears on the dashboard immediately

### Edit a profile

From the home dashboard:

1. On any profile card, tap "Edit"
2. The same modal opens pre-filled with existing values
3. Modify any field and tap Save; the card updates in place

From the profile detail page (`/profiles/:id`):

1. Tap the pencil icon in the top bar
2. The same edit modal opens pre-filled with existing values
3. Modify any field and tap Save; the top bar name and profile card update in place

### Delete a profile

1. On any profile card on the home dashboard, tap "Delete"
2. A confirmation dialog opens: "Are you sure you want to remove [name]?"
3. Tap the danger-red Delete button to confirm; profile card is removed from the dashboard

---

## 3. Adding a Medication

**Actor:** Caretaker (Admin)

1. From home dashboard, tap a profile card (`designs/02-home-dashboard.svg`)
2. Profile detail opens (`designs/03-profile-detail.svg`)
3. Tap the Medications tab (`designs/04-medications.svg`)
4. Tap "Add Medication" button
5. Modal opens; fill form: name, dosage, schedule (multi-select: morning/afternoon/evening/bedtime), status (active/discontinued)
6. Tap Save
7. Medication appears in the active list with inline dosage and schedule badges

---

## 4. Doctor Visit Workflow

**Actor:** Caretaker (Admin), at a doctor's office

1. Doctor provides paper documents (lab results, prescriptions)
2. Open CareHub on phone, navigate to the profile (`designs/03-profile-detail.svg`)
3. Tap Calendar tab (`designs/05-calendar.svg`)
4. Create a calendar event for the visit (date, doctor name, location)
5. Tap Journal tab (`designs/06-journal-entry.svg`)
6. Tap "+ Add" to create a new journal entry (`designs/06c-journal-modal.svg`)
7. Enter title (e.g., "Post-Visit Notes"), select the date
8. Use the "Link to Event" dropdown to connect the entry to the calendar event
9. Write key takeaways in bullet form for quick reference
10. Write detailed notes in the Notes field
11. Optionally star the entry for quick access
12. Tap Save; entry appears in the journal list
13. All related data is now connected: event and journal entry

---

## 5. Setting Up and Pairing a Tablet

**Actor:** Caretaker (Admin), with physical access to the tablet

1. Sideload the CareHub kiosk APK onto the tablet
2. Open the app; it launches in Lock Task Mode (full-screen, no exit)
3. Tablet displays a QR code on its pairing screen (`designs/13-tablet-qr-pairing.svg`)
4. On phone: navigate to Devices section in portal (`designs/09-devices.svg`)
5. Tap "Pair New Tablet" (`designs/10-pair-tablet.svg`)
6. Phone camera opens
7. Walk to the tablet and scan the QR code displayed on screen
8. Portal shows confirmation: select which care profiles to assign to this tablet
9. Tap Confirm
10. Tablet receives pairing confirmation via WebSocket
11. Tablet transitions to kiosk home screen (`designs/11-tablet-home.svg`)
12. Device appears in portal device list with online status
13. Future updates are delivered automatically via Capgo OTA -- no manual reinstall needed

---

## 6. Calling Grandparent from Portal

**Actor:** Caretaker (Admin or Viewer)

1. From home dashboard, tap the grandparent's profile card
2. On profile detail page, tap "Call Tablet" button
3. Portal requests microphone and camera permissions (first time only)
4. WebRTC signaling initiates; call request sent to tablet via WebSocket (or FCM if WebSocket is disconnected)
5. Tablet app displays incoming call screen with caretaker's name and photo (`designs/12-tablet-incoming-call.svg`)
6. Grandparent taps the large Accept button
7. Video call connects; both sides see and hear each other
8. Either party can end the call

---

## 7. Grandparent Calling Caretaker

**Actor:** Elderly family member (Tablet user)

1. Grandparent sees kiosk home screen with caretaker photo cards (`designs/11-tablet-home.svg`)
2. Taps a caretaker's photo card
3. Tablet shows "Calling..." state; call request sent to server via WebSocket
4. Server sends a high-priority FCM data message to caretaker's phone
5. Caretaker's phone displays a **full-screen incoming call notification** (over lock screen) with grandparent's name, photo, ringtone, and vibration
6. Caretaker taps the large Accept button
7. App opens (or foregrounds); WebRTC video call connects full-screen on both sides
8. Either party can end the call
9. If caretaker does not answer within timeout, tablet shows "No Answer" and returns to home screen

---

## 8. Pushing Content to Tablet

**Actor:** Caretaker (Admin)

1. Navigate to Devices section in portal (`designs/09-devices.svg`)
2. Select the target tablet
3. Tap "Push Content"
4. Choose content type: photo, appointment reminder, or text message
5. Select or compose the content
6. Tap Send
7. Content is delivered to the tablet via WebSocket (or FCM if WebSocket is disconnected)
8. Tablet app displays the content immediately (photo fills screen, appointment shows as card, message displays with large text)

---

## 9. Inviting a New Viewer

**Actor:** Caretaker (Admin)

1. Navigate to Settings in portal
2. Tap "Invite Member"
3. Enter the person's email address
4. Select role: Viewer (read-only access)
5. Tap Send Invite
6. System sends email invitation with a login link
7. New user navigates to login, enters email, completes OTP verification, and lands on the home dashboard
8. Viewer sees all household profiles in read-only mode

---

## 10. Searching Documents

**Actor:** Caretaker (Admin or Viewer)

1. Navigate to a profile's Documents tab (`designs/07-documents.svg`)
2. Tap the search bar
3. Type a search term (e.g., "cholesterol")
4. PostgreSQL full-text search queries the OCR-extracted text across all documents for this profile
5. Results display matching documents with highlighted excerpts
6. Tap a result to view the full document (`designs/08-document-detail.svg`)
7. Original image and extracted text displayed side by side

---

## 11. Creating a Journal Entry

**Actor:** Caretaker (Admin)

1. From home dashboard, tap a profile card (`designs/02-home-dashboard.svg`)
2. Profile detail opens with 4 tabs: Overview, Meds, Calendar, Journal (`designs/03-profile-detail.svg`)
3. Tap the Journal tab (`designs/06-journal-entry.svg`)
4. Tap "+ Add" button
5. Modal opens (`designs/06c-journal-modal.svg`)
6. Fill in: Title (required), Date (defaults to today), Link to Event (optional dropdown of existing events), Key Takeaways (optional), Notes (required)
7. Optionally tap "Star this entry" to mark for quick access
8. Tap Save
9. Entry appears in the journal list, sorted by date

---

## 12. Searching Journal Entries

**Actor:** Caretaker (Admin or Viewer)

1. Navigate to a profile's Journal tab (`designs/06-journal-entry.svg`)
2. Tap the search bar at the top
3. Type a search term (e.g., "blood pressure")
4. PostgreSQL full-text search queries title, content, and key takeaways
5. Results update in real-time as you type (debounced)
6. Tap a result to view the full entry (`designs/06b-journal-detail.svg`)
7. If the entry is linked to a calendar event, tap the link to navigate to the Calendar tab

---

## 13. Viewing Linked Journal from Event

**Actor:** Caretaker (Admin or Viewer)

1. Navigate to Calendar tab and view an event
2. If journal entries are linked to this event, they appear in a "Linked Journal" section
3. Tap a linked journal entry to view its full content
4. Cross-linking allows navigating between events and their related notes
