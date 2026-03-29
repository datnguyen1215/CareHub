# UI/UX Design Guidelines

## Design Approach

Styles are implemented with Tailwind CSS within the SvelteKit frontend package. Mobile-first responsive design. The caretaker portal is built for phone-sized screens first, then adapted for tablet and desktop. The caretaker mobile app is the same SvelteKit web app wrapped in Capacitor, with native incoming call UI for phone-style call notifications. The elderly tablet runs a separate Capacitor APK with a kiosk layout optimized for large touch targets, locked to the screen via Android Lock Task Mode.

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

### Card-Based Layout

- All profiles, medications, events, and documents displayed as cards
- Cards have white background, subtle shadow (`0 1px 3px rgba(0,0,0,0.12)`)
- Rounded corners (8px)
- Consistent padding (16px)

### Navigation -- Portal

- **Bottom navigation bar** with three items: Home, Devices, Settings
- Active tab highlighted with primary color
- Icons with labels below

### Navigation -- Profile Detail

- **Tab navigation** within each profile: Overview, Meds, Calendar, Documents
- Horizontal scrollable tabs below profile header
- Active tab underlined with primary color

### Spacing

- 8px base unit
- Component padding: 16px (2 units)
- Section gaps: 24px (3 units)
- Screen edge margins: 16px

---

## Tablet Kiosk Design

- Runs as Capacitor APK in Android Lock Task Mode -- user cannot exit the app
- Auto-launches on device boot; updates automatically via Capgo OTA
- Minimum 80px touch targets for all buttons and interactive elements
- No text input fields anywhere -- all interactions are taps
- Maximum 2-3 taps to reach any function
- Large profile photos and names for easy recognition
- Current time and date displayed prominently
- Personalized greeting ("Good morning, Grandma")
- Auto-reconnect on network interruption with visible status indicator
- Incoming call screen uses near-full-screen Accept (green) and Decline (red) buttons

---

## Wireframe Reference

All wireframes are in the `designs/` directory.

| File                          | Screen               | Description                                                                             |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| `01-login.svg`                | Login                | Authentication screen with email + OTP login                                            |
| `02-home-dashboard.svg`       | Home Dashboard       | Grid of care profile cards showing name, relationship, conditions, and medication count |
| `03-profile-detail.svg`       | Profile Detail       | Profile header with health summary and tab navigation                                   |
| `04-medications.svg`          | Medications          | List of active and discontinued medications with time-of-day badges                     |
| `05-calendar.svg`             | Calendar             | Monthly calendar view with event dots and upcoming appointments                         |
| `06-journal-entry.svg`        | Journal Entry        | Entry form with content field, key takeaways, and linked event                          |
| `07-documents.svg`            | Documents            | Document grid with categories, search bar, and upload button                            |
| `08-document-detail.svg`      | Document Detail      | Original image alongside extracted OCR text and metadata                                |
| `09-devices.svg`              | Devices              | List of paired tablets with status, battery, and last seen                              |
| `10-pair-tablet.svg`          | Pair Tablet          | QR scanning interface for pairing a new tablet                                          |
| `11-tablet-home.svg`          | Tablet Home (Kiosk)  | Large caretaker cards, today's schedule, greeting                                       |
| `12-tablet-incoming-call.svg` | Tablet Incoming Call | Full-screen caller info with large Accept/Decline buttons                               |
| `13-tablet-qr-pairing.svg`    | Tablet QR Pairing    | QR code display on tablet during pairing flow                                           |
| `14-flow-diagram.svg`         | Flow Diagram         | Overall system flow showing user journeys between screens                               |
