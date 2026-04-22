# CareHub Backend

Express REST API with TypeScript, PostgreSQL, and JWT authentication.

## Overview

The backend provides a REST API for user authentication, profile management, and medication tracking. It uses:

- **Express** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **Drizzle ORM** - Type-safe database queries
- **Zod** - Request validation schemas
- **JWT** - Authentication tokens (httpOnly cookies)
- **Nodemailer** - OTP email delivery

## Setup

### Prerequisites

- Node.js v16+
- PostgreSQL (via Docker from root)
- Gmail account with app password

### Environment Variables

Create a `.env` file in the **project root** (not in this package directory) with:

```bash
# Database
DATABASE_URL=postgresql://carehub:carehub_dev@localhost:9392/carehub
DATABASE_URL_TEST=postgresql://carehub:carehub_dev@localhost:9392/carehub_test

# Auth
JWT_SECRET=<generate-random-string>  # Use: openssl rand -base64 32

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<gmail-app-password>
SMTP_FROM_NAME=CareHub

# App
NODE_ENV=development
PORT=9391
FRONTEND_URL=http://localhost:9390
```

### Important: .env Symlink Requirement

⚠️ **The backend loads environment variables from the working directory**, not the package directory.

If running backend commands directly (not from root), create a symlink:

```bash
cd packages/backend
ln -s ../../.env .env
```

**Recommended**: Always run from project root using workspace commands:

```bash
npm run dev --workspace=packages/backend
```

### Installation

From project root:

```bash
npm install
```

### Database Setup

1. Start PostgreSQL (from project root):

   ```bash
   npm run db:up
   ```

2. Run migrations (from project root):
   ```bash
   cd packages/shared
   npm run db:migrate
   cd ../..
   ```

## Available Scripts

From this directory:

- `npm run dev` - Start development server with hot reload (nodemon + tsx)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled production server
- `npm run test` - Run tests with Vitest

From project root:

- `npm run dev --workspace=packages/backend` - Start backend in development mode
- `npm run test --workspace=packages/backend` - Run backend tests

## API Overview

Base URL: `http://localhost:9391/api`

### Authentication

- `POST /auth/request-otp` - Request OTP code (60s cooldown, 15min expiry)
- `POST /auth/verify-otp` - Verify OTP, returns JWT httpOnly cookie
- `POST /auth/logout` - Clear authentication cookie

### Users

- `GET /users/me` - Get current user profile
- `PATCH /users/me` - Update user profile

### Groups

- `GET /groups` - List user's groups

### Profiles

- `GET /groups/:groupId/profiles` - List profiles in group
- `POST /groups/:groupId/profiles` - Create profile
- `GET /groups/:groupId/profiles/:id` - Get profile details
- `PATCH /groups/:groupId/profiles/:id` - Update profile
- `DELETE /groups/:groupId/profiles/:id` - Delete profile

### Medications

- `GET /groups/:groupId/profiles/:profileId/medications` - List medications
- `POST /groups/:groupId/profiles/:profileId/medications` - Create medication
- `PATCH /groups/:groupId/profiles/:profileId/medications/:id` - Update medication
- `DELETE /groups/:groupId/profiles/:profileId/medications/:id` - Delete medication

### Devices

- `GET /devices` - List devices user has access to
- `POST /devices/pair` - Complete pairing by scanning QR token
- `GET /devices/:id` - Get device details; response includes `appVersion` (current installed app semver, nullable)
- `PATCH /devices/:id` - Update device name
- `DELETE /devices/:id` - Unpair/remove device
- `POST /devices/:id/update` - Trigger OTA APK update; body: `{ releaseId }`; returns 409 if device offline
- `POST /devices/:id/profiles` - Assign profiles to device
- `DELETE /devices/:id/profiles/:profileId` - Remove profile from device

All protected endpoints require JWT token via httpOnly cookie.

### WebSocket API

WebSocket endpoint: `ws://localhost:9391/ws`

**Connection Authentication:**

- Devices: `ws://localhost:9391/ws?token={device_token}`
- Users: `ws://localhost:9391/ws?jwt={jwt_token}`

**Device Messages (Kiosk → Server):**

- `heartbeat` - Periodic keepalive with optional `batteryLevel` (number) and `appVersion` (semver string)
- `status_update` - Device online/offline status changes
- `call:accepted` - Device accepts incoming call
- `call:declined` - Device declines incoming call
- `call:answer` - SDP answer to user's offer (WebRTC)
- `call:ice-candidate` - ICE candidate for WebRTC connection
- `call:ended` - Device ends call
- `app:update-status` - OTA update progress (downloading/installing/success/failed); on success the backend persists the new version; portal users are notified via server broadcast

**User Messages (Portal → Server):**

- `call:initiate` - Initiate call to device (requires deviceId, optional profileId)
- `call:offer` - SDP offer to device (WebRTC)
- `call:ice-candidate` - ICE candidate for WebRTC connection
- `call:ended` - User ends call

**Server Messages (Server → Device):**

- `device_paired` - Pairing completed, includes assigned profiles
- `device_revoked` - Device unpaired, clear data
- `profiles_updated` - Profile assignments changed
- `call:incoming` - Incoming call from user with caller info
- `call:ringing` - Call is ringing (sent to caller)
- `call:accepted` - Device accepted call
- `call:declined` - Device declined call
- `call:offer` - SDP offer from user (WebRTC)
- `call:answer` - SDP answer from device (WebRTC)
- `call:ice-candidate` - ICE candidate for WebRTC connection
- `call:ended` - Call terminated (with reason: normal, missed, failed, declined)
- `call:error` - Call error (e.g., device offline, permission denied)
- `app:update` - Trigger OTA app update; payload: `{ releaseId, version, downloadUrl, checksum }`

**Call Session States:**

- `initiating` - Call session created, sending to device
- `ringing` - Device notified, waiting for response (30s timeout)
- `connecting` - Device accepted, WebRTC negotiation in progress
- `connected` - WebRTC connection established
- `ended` - Call terminated (terminal state)
- `failed` - Call failed (terminal state)

**Call End Reasons:**

- `normal` - Either party ended call normally
- `missed` - Device did not respond within 30 seconds
- `declined` - Device declined the call
- `failed` - Connection failed (e.g., device disconnected)

For implementation details, see:

- `src/index.ts` - HTTP server entry point; centralized SIGTERM/SIGINT graceful shutdown
- `src/websocket/index.ts` - WebSocket server setup and routing; returns `WebSocketServer` instance
- `src/websocket/clients.ts` - Client registry with multi-tab support
- `src/websocket/handlers/device.ts` - Device message handlers
- `src/websocket/handlers/user.ts` - User message handlers
- `src/websocket/handlers/call.ts` - Call signaling handlers
- `src/services/call.ts` - Call session database operations

## Project Structure

```
packages/backend/
├── src/
│   ├── routes/          # API endpoint handlers
│   │   ├── auth.ts      # Authentication endpoints
│   │   ├── users.ts     # User management
│   │   ├── groups.ts    # Group management
│   │   ├── profiles.ts  # Profile management
│   │   └── medications.ts # Medication tracking
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts      # JWT authentication
│   │   └── validate.ts  # Zod request validation middleware
│   ├── schemas/         # Zod validation schemas
│   │   ├── auth.ts      # Auth request schemas
│   │   ├── profiles.ts  # Profile request schemas
│   │   ├── medications.ts # Medication request schemas
│   │   ├── events.ts    # Event request schemas
│   │   ├── journal.ts   # Journal request schemas
│   │   ├── attachments.ts # Attachment request schemas
│   │   ├── devices.ts   # Device request schemas
│   │   └── query.ts     # Query param schemas (pagination)
│   ├── services/        # Business logic
│   │   └── email.ts     # OTP email delivery
│   ├── db/              # Database connection
│   │   └── index.ts     # Drizzle client
│   └── index.ts         # Express app entry point
├── tests/               # Test files
│   ├── helpers/          # Test utilities (ws.ts, truncate.ts)
│   ├── websocket/        # WebSocket integration tests
│   └── *.test.ts         # HTTP endpoint tests
└── package.json
```

## Tech Stack

- **Express** 4.x - Web framework
- **TypeScript** 5.x - Language
- **Drizzle ORM** - Database queries
- **Zod** - Request validation
- **PostgreSQL** - Database
- **jsonwebtoken** - JWT tokens
- **cookie-parser** - Cookie handling
- **nodemailer** - Email delivery
- **tsx** - TypeScript execution (replaces ts-node)
- **Vitest** - Testing framework

## Development Notes

### Why tsx instead of ts-node?

The backend uses `tsx` for running TypeScript files because it properly resolves npm workspace dependencies (`@carehub/shared`).

- ✅ `tsx` - Supports workspace packages
- ❌ `ts-node` - Issues with workspace module resolution

The dev script: `nodemon --exec tsx src/index.ts`

### Hot Reload

The development server uses `nodemon` to watch for file changes and automatically restart the server.

### Testing

Run tests with:

```bash
npm run test
```

Tests use Vitest and Supertest for API endpoint testing, and the `ws` package for WebSocket integration tests (connection auth, client registry, device lifecycle, call signaling). Tests run with `fileParallelism: false`.

The `pretest` hook does two things automatically before each test run:

1. **Rebuilds `@carehub/shared`** — ensures `packages/shared/dist/` is always up to date, preventing stale compiled output from causing ESM import errors.
2. **Provisions `carehub_test`** — runs `scripts/ensure-test-db.ts`, which connects to Postgres and creates the `carehub_test` database if it doesn't already exist. This is idempotent: it's a no-op when the database exists. After the database is confirmed present, `tests/setup.ts` runs Drizzle migrations automatically.

Database connection for tests is read from `DATABASE_URL_TEST` in the shell environment (or `.env`). The default in `src/config/env.ts` is `postgresql://carehub:carehub_dev@localhost:9392/carehub_test`, matching the dev Docker service.

If Postgres is not running when you run `npm test`, the pretest script exits immediately with a clear error message pointing you at `docker compose up -d db`.

## Troubleshooting

### JWT_SECRET Not Loading

**Symptom**: "JWT_SECRET is not defined" error

**Cause**: Backend loads .env from working directory, not package directory

**Solution**:

1. Run from project root: `npm run dev --workspace=packages/backend`
2. Or create symlink: `cd packages/backend && ln -s ../../.env .env`

### Port Already in Use

**Symptom**: "EADDRINUSE: address already in use :::9391"

**Solution**:

```bash
# Find process
lsof -i :9391

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Test Database Missing

**Symptom**: `error: database "carehub_test" does not exist` when running `npm test`

**Cause**: The `carehub_test` database was not provisioned. This can happen on fresh Docker volumes or existing volumes initialized before `carehub_test` existed.

**Solution**: The `pretest` hook creates it automatically when Postgres is running. Just ensure the database container is up:

```bash
docker compose up -d db
npm test
```

The `scripts/ensure-test-db.ts` script connects to the `postgres` system database and issues `CREATE DATABASE carehub_test` if the database is missing. It is safe to run repeatedly — it no-ops if the database already exists.

### Database Connection Failed

**Symptom**: "Connection refused" or "ECONNREFUSED"

**Solution**:

1. Check Docker is running: `docker ps`
2. Start database: `npm run db:up` (from root)
3. Verify DATABASE_URL port matches Docker (9392)
4. Check logs: `docker compose logs db`

### SMTP/Email Errors

**Symptom**: OTP emails not sending

**Solution**:

1. Use Gmail app password, not regular password
2. Enable 2FA on Gmail account first
3. Generate app password: Google Account → Security → 2-Step Verification → App passwords
4. Verify SMTP_USER and SMTP_PASS in .env

## Production Deployment

1. Build the backend:

   ```bash
   npm run build
   ```

2. Set production environment variables

3. Run migrations:

   ```bash
   cd packages/shared && npm run db:migrate
   ```

4. Start the server:
   ```bash
   npm run start
   ```

For more deployment options, see the root [README](../../README.md) and [docs/deployment.md](../../docs/deployment.md).
