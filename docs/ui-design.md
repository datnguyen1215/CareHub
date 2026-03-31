# UI/UX Design Guidelines

## Design Approach

Styles are implemented with Tailwind CSS within the SvelteKit portal package. Mobile-first responsive design. The caretaker portal is built for phone-sized screens first, then adapted for tablet and desktop. The caretaker mobile app is the same SvelteKit web app wrapped in Capacitor, with native incoming call UI for phone-style call notifications. The elderly tablet runs a separate Capacitor APK with a kiosk layout optimized for large touch targets, locked to the screen via Android Lock Task Mode.

---

## Design Principles

1. **Simplicity** -- Every screen serves one clear purpose. Remove elements until nothing else can be removed.
2. **Large touch targets** -- Minimum 44px for portal, minimum 80px for tablet kiosk. Generous spacing between interactive elements.
3. **Progressive disclosure** -- Show summary information first; details on demand. Avoid overwhelming users with all data at once.
4. **Consistency** -- Same patterns across all screens. Cards look like cards everywhere. Buttons behave the same way everywhere.
5. **Accessibility** -- Sufficient color contrast (WCAG AA), readable font sizes, clear focus indicators.

---

## Color Scheme

| Role           | Color       | Hex       | Usage                                                |
| -------------- | ----------- | --------- | ---------------------------------------------------- |
| Primary        | Blue        | `#4A90D9` | Actions, links, active states, headers               |
| Success        | Green       | `#5CB85C` | Positive status, confirmations, active medications   |
| Warning        | Amber       | `#F0AD4E` | Attention needed, pending states                     |
| Danger         | Red         | `#D9534F` | Destructive actions, critical alerts, declined calls |
| Background     | Light gray  | `#F5F5F5` | Page backgrounds                                     |
| Surface        | White       | `#FFFFFF` | Cards, modals, input fields                          |
| Text Primary   | Dark gray   | `#333333` | Body text                                            |
| Text Secondary | Medium gray | `#666666` | Labels, captions, secondary info                     |

---

## Typography

- **Font stack:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Base size:** 16px
- **Headings:** 1.25rem (h3), 1.5rem (h2), 1.75rem (h1)
- **Body:** 1rem
- **Small/caption:** 0.875rem
- **Tablet kiosk:** Base size 20px, headings scaled up proportionally

---

## Layout Patterns

### List Row Layout

- Profile list uses full-width horizontal rows for better readability
- Each row contains: avatar (left), info section (middle), chevron (right)
- Info section shows: name, relationship + medication count, device status, condition badges
- Rows have white background, subtle shadow, rounded corners (8px), consistent padding (16px)
- Tapping a row navigates to the detail view

### Card-Based Layout

- Medications, events, and documents displayed as cards
- Cards have white background, subtle shadow (`0 1px 3px rgba(0,0,0,0.12)`)
- Rounded corners (8px)
- Consistent padding (16px)

### Toast Notifications

- Positioned at bottom of screen, above bottom navigation (z-index 40)
- Three types: success (green), error (red), destructive (red)
- Success/destructive: auto-dismiss after 3 seconds with slide-up animation
- Error: manual dismiss button required
- Each toast includes icon (checkmark for success, X for destructive, exclamation for error) and message
- Rounded card style with colored background and border
- Maximum width: responsive (full width on mobile with padding, max-w-md on larger screens)

### Navigation -- Portal

- **Bottom navigation bar** with four items: Home, Profiles, Devices, Settings
- Active tab highlighted with primary color
- Icons with labels below
- Home tab uses house icon instead of calendar icon

### Navigation -- Profile Detail

- **Tab navigation** within each profile: Overview, Meds, Calendar, Journal
- Horizontal scrollable tabs below profile header
- Active tab underlined with primary color

### Device Card (Profile Overview)

- Displayed in Profile Overview tab between avatar header and profile info card
- Shows device name with 📱 icon and online/offline status dot
- Battery level indicator (when available)
- Three action buttons: "📷 Send Photo", "📞 Call", "⚙️" (Settings)
- Send Photo and Call buttons disabled (grayed out) when device is offline
- Settings button navigates to `/devices/[id]`
- If profile has multiple devices, cards stack vertically
- Empty state: "No device linked" with "+ Link Device" CTA linking to `/devices/pair`

### Spacing

- 8px base unit
- Component padding: 16px (2 units)
- Section gaps: 24px (3 units)
- Screen edge margins: 16px

---

## Tablet Kiosk Design

### Runtime

- Runs as SvelteKit web app (Capacitor APK wrapper planned for Phase 3.6)
- Separate package: `packages/kiosk` on port 9393
- Persistent WebSocket connection for real-time updates
- Device token authentication (stored in localStorage, will migrate to Capacitor Secure Storage)

### Design System

- **Touch targets:** Minimum 80px (Tailwind `unit-10`)
- **Typography:** Base 20px, headings 32-48px (scaled up from portal)
- **Colors:** Inherited from portal with high contrast
- **Spacing:** Increased base spacing for large touch targets
- **No text input:** All interactions are taps only
- **Maximum depth:** 2-3 taps to reach any function

### Screens

**Pairing Screen (`/pairing`):**

- Large centered QR code (auto-refreshes every 4 minutes)
- Instructions: "Scan this code from your CareHub portal"
- Waits for `device_paired` WebSocket event
- On paired: stores device_token, navigates to home

**Home Screen (`/home`):**

- Displays if multiple profiles assigned (redirects to dashboard if single profile)
- Greeting and current time/date
- Profile card grid with large photos and names
- Tap profile → navigate to `/profile/[id]`

**Profile Dashboard (`/profile/[id]`):**

- Back button (if multiple profiles) → `/home`
- Personalized greeting: "Good morning, [Name]!"
- Current time and date display
- Caretaker cards grid (large photos, names)
- Today's appointments section
- Tap caretaker → initiate call (Phase 3.5)

**Connection Status:**

- Subtle indicator in top corner
- Shows "Reconnecting..." when WebSocket disconnected
- Auto-reconnects with exponential backoff

### Future Enhancements (Phase 3.5+)

- Incoming call screen with near-full-screen Accept (green) and Decline (red) buttons
- Active call UI with end call button
- Missed call notifications

---

## Portal Device Management UI

### Components

| Component                 | File                       | Purpose                                                                                                                  |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `DeviceCard.svelte`       | `src/lib/`                 | Device card with name, status dot, battery indicator, assigned profiles, and action buttons (Send Photo, Call, Settings) |
| `DeviceStatusDot.svelte`  | `src/lib/`                 | Reusable online (green) / offline (gray) status indicator                                                                |
| `BatteryIndicator.svelte` | `src/lib/`                 | Battery level progress bar with percentage (color-coded: green > 50%, yellow 20-50%, red < 20%)                          |
| `QRScanner.svelte`        | `src/lib/`                 | Camera-based QR scanner using html5-qrcode with corner bracket overlay and manual code entry fallback                    |
| `ProfileSelector.svelte`  | `src/lib/`                 | Checkbox list for selecting profiles with avatars                                                                        |
| `CallModal.svelte`        | `src/lib/components/call/` | Full-screen modal for active video calls with local/remote video, call status, and controls                              |
| `CallControls.svelte`     | `src/lib/components/call/` | Control buttons for mute, video toggle, and end call with keyboard shortcuts (M, V, Escape)                              |

### Devices Page (`/devices`)

- Device list with DeviceCard components
- Each card shows: device name, status dot, assigned profile avatars, battery level, last active timestamp
- Action buttons: "Send Photo" (disabled when offline), "Call" (disabled when offline), "Settings" (navigates to detail)
- "+ Pair New Tablet" button (dashed border style) navigates to pairing flow
- Empty state: tablet illustration, "No tablets paired yet", value prop, "+ Pair Your First Tablet" CTA

### Pair Tablet Flow (`/devices/pair`)

3-step wizard with progress indicator:

**Step 1 - Scan QR:**

- Camera viewfinder with corner bracket overlay
- "Position QR code in frame" instruction
- Fallback: "Enter code manually" link opens 8-character input
- Haptic feedback on successful scan
- Auto-advances to Step 2

**Step 2 - Select Profiles:**

- Checkbox list of all group profiles
- At least one profile required to continue
- "Continue" button advances to Step 3

**Step 3 - Confirm & Name:**

- Device name input (pre-filled "New Tablet")
- Summary of selected profiles
- "Pair Device" button completes pairing
- Success state: checkmark animation, auto-redirect after 2 seconds

### Device Detail Page (`/devices/[id]`)

- Header with back arrow and inline-editable device name (pencil icon)
- Status section: online/offline dot, battery progress bar, last active timestamp
- Actions section: "Send Photo" and "Call" buttons (disabled when offline or call in progress)
- Call button shows "Calling..." text during initiating/ringing states
- Clicking Call button initiates video call and opens full-screen CallModal
- CallModal displays during active calls with call status, local/remote video streams, duration timer, and controls
- CallControls provides mute (M key), video toggle (V key), and end call (Escape key) buttons
- Assigned Profiles section: grid of profile cards with remove (×) button, "+ Add" link
- Danger Zone: "Unpair Device" button with confirmation modal

---

## Wireframe Reference

All wireframes are in the `designs/` directory.

| File                          | Screen                 | Description                                                                               |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| `01-login.svg`                | Login — Email Entry    | Email input and "Send Code" button; entry point for OTP authentication                    |
| `01b-otp-verify.svg`          | Login — OTP Verify     | 6-digit code input, 60-second resend cooldown, and "Use a different email" link           |
| `01c-account-setup.svg`       | Login — Account Setup  | First and last name inputs shown to new users after their first OTP verification          |
| `02-home-dashboard.svg`       | Home (Upcoming Events) | Upcoming events grouped by day with profile indicators, time, and color-coded event types |
| `02b-profile-list.svg`        | Profile List           | Full-width profile rows with avatar, info, device status, conditions, and chevron         |
| `03-profile-detail.svg`       | Profile Detail         | Profile header with health summary and tab navigation                                     |
| `04-medications.svg`          | Medications            | List of active and discontinued medications with time-of-day badges                       |
| `05-calendar.svg`             | Calendar               | Monthly calendar view with event dots and upcoming appointments                           |
| `06-journal-entry.svg`        | Journal Tab            | Journal entries list with search, sort, and starred entries                               |
| `06b-journal-detail.svg`      | Journal Entry Detail   | Full entry view with key takeaways section and linked event navigation                    |
| `06c-journal-modal.svg`       | Journal Entry Modal    | Add/edit modal with title, date, event linking, key takeaways, and notes                  |
| `07-documents.svg`            | Documents Tab          | Search/browse view across all profile attachments with categories and filters             |
| `08-document-detail.svg`      | Attachment Detail      | Original image alongside extracted OCR text, description, and parent context link         |
| `09-devices.svg`              | Devices                | List of paired tablets with status, battery, and last seen                                |
| `10-pair-tablet.svg`          | Pair Tablet            | QR scanning interface for pairing a new tablet                                            |
| `11-tablet-home.svg`          | Tablet Home (Kiosk)    | Large caretaker cards, today's schedule, greeting                                         |
| `12-tablet-incoming-call.svg` | Tablet Incoming Call   | Full-screen caller info with large Accept/Decline buttons                                 |
| `13-tablet-qr-pairing.svg`    | Tablet QR Pairing      | QR code display on tablet during pairing flow                                             |
| `14-flow-diagram.svg`         | Flow Diagram           | Overall system flow showing user journeys between screens                                 |
