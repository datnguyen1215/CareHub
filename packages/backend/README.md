# CareHub Backend

Express REST API with TypeScript, PostgreSQL, and JWT authentication.

## Overview

The backend provides a REST API for user authentication, profile management, and medication tracking. It uses:
- **Express** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **Drizzle ORM** - Type-safe database queries
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

All protected endpoints require JWT token via httpOnly cookie.

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
│   │   └── auth.ts      # JWT authentication
│   ├── services/        # Business logic
│   │   └── email.ts     # OTP email delivery
│   ├── db/              # Database connection
│   │   └── index.ts     # Drizzle client
│   └── index.ts         # Express app entry point
├── tests/               # Test files
└── package.json
```

## Tech Stack

- **Express** 4.x - Web framework
- **TypeScript** 5.x - Language
- **Drizzle ORM** - Database queries
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

Tests use Vitest and supertest for API endpoint testing.

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
