# CareHub

CareHub is a web-based family caregiving platform that helps caretakers manage health information, medications, appointments, and documents for elderly family members, while enabling direct communication through wall-mounted Android tablets in their homes.

## Problem Statement

Managing health care for multiple elderly family members involves tracking medications, doctor visits, lab results, insurance documents, and daily health metrics across 4-6 people. Paper records get lost, information is scattered across apps and notebooks, and staying connected with grandparents and parents requires tools they can actually use. CareHub centralizes all of this into one platform with an elderly-friendly tablet interface that requires zero technical skill.

## Core Users

- **Caretakers (Admin)** -- Primary users (e.g., you and your wife) who manage all health data, devices, and communication. Full CRUD access to all profiles and settings.
- **Viewers** -- Invited family members who can view health information but cannot modify it. Added via email invitation.
- **Elderly Family Members (Tablet Users)** -- Grandparents and parents who interact through wall-mounted tablets with a simplified, tap-only kiosk interface. No accounts required.

## High-Level Features

- Authentication via email + OTP (Nodemailer + Gmail SMTP)
- Household-based care profiles with health dashboards
- Medication tracking with schedules and status
- Calendar for appointments and doctor visits
- Journal entries and visit notes
- Attachment storage with AI-powered OCR and search
- Android tablet kiosk app (Capacitor) with elderly-friendly UI and lock task mode
- QR-based tablet pairing
- WebRTC video calling with native phone-style incoming call experience
- Firebase Cloud Messaging for reliable push notifications
- Capacitor-wrapped native apps for caretaker phones and elderly tablets (Android)
- Over-the-air updates via Capgo (no manual APK reinstall)
- Remote content push to tablets
- Role-based access with email invitations

## Documentation

| Document                           | Description                                       |
| ---------------------------------- | ------------------------------------------------- |
| [Roadmap](../ROADMAP.md)           | Project milestones and progress tracking          |
| [Features](features.md)            | Detailed feature specifications by area           |
| [Architecture](architecture.md)    | Technical stack, data model, and key decisions    |
| [User Flows](user-flows.md)        | Step-by-step workflows for core tasks             |
| [UI/UX Design](ui-design.md)       | Design guidelines, colors, typography, wireframes |
| [Implementation Phases](phases.md) | Phased delivery plan with key deliverables        |

## Wireframes

14 wireframe designs are available in the `designs/` directory. See [UI/UX Design](ui-design.md) for descriptions of each.
