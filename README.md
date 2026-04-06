# CareHub

A healthcare management platform for managing profiles, medications, and care coordination.

## Overview

CareHub is a monorepo application built with:

- **Backend**: Express + TypeScript + PostgreSQL + Drizzle ORM
- **Frontend**: SvelteKit 5 + Svelte 5 runes + Tailwind CSS
- **Authentication**: JWT via httpOnly cookies with OTP email login

## Prerequisites

- **Node.js** v16+ (v22 recommended)
- **Docker** (for PostgreSQL database)
- **Git**
- **Gmail account** with app password (for OTP email delivery)

## Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd carehub
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   - `JWT_SECRET` - Set to a random string (e.g., `openssl rand -base64 32`)
   - `SMTP_USER` - Your Gmail address
   - `SMTP_PASS` - Gmail app password (not your regular password)
   - Other variables can use the defaults for local development

4. **Start the database**

   ```bash
   npm run db:up
   ```

5. **Run database migrations**

   ```bash
   cd packages/shared
   npm run db:migrate
   cd ../..
   ```

6. **Start the development servers**
   ```bash
   npm run dev
   ```

The application will be available at:

- **Frontend**: http://localhost:9390
- **Backend API**: http://localhost:9391
- **Database**: localhost:9392

## Environment Configuration

Copy `.env.example` to `.env` and configure the following:

### Required Variables

- `JWT_SECRET` - Secret for signing JWT tokens (generate with `openssl rand -base64 32`)
- `SMTP_USER` - Gmail address for sending OTP codes
- `SMTP_PASS` - Gmail app password

### Database

- `DATABASE_URL` - PostgreSQL connection string (default: `postgresql://carehub:carehub_dev@localhost:9392/carehub`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - Docker PostgreSQL credentials

### App Configuration

- `PORT` - Backend port (default: 9391)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:9390)
- `NODE_ENV` - Environment mode (development/production)

### AI Configuration

- `AI_PROVIDER` - AI provider to use for document descriptions and categorization: `openai`, `anthropic`, or `fallback` (default: `fallback`)
- `OPENAI_API_KEY` - OpenAI API key (required when using OpenAI provider)
- `ANTHROPIC_API_KEY` - Anthropic API key (required when using Anthropic provider)
- `OPENAI_MODEL` - OpenAI model name (default: `gpt-4o-mini`)
- `ANTHROPIC_MODEL` - Anthropic model name (default: `claude-3-haiku-20240307`)

## Port Configuration

| Service  | Port | URL                   |
| -------- | ---- | --------------------- |
| Frontend | 9390 | http://localhost:9390 |
| Backend  | 9391 | http://localhost:9391 |
| Database | 9392 | localhost:9392        |

## Available Commands

### Root Level

- `npm run dev` - Start all services concurrently (frontend, backend, shared)
- `npm run db:up` - Start PostgreSQL database container
- `npm run db:down` - Stop PostgreSQL database container
- `npm run test:portal` - Run portal tests (Vitest)
- `npm run release:kiosk -- --version X.Y.Z` - Build, sign, and upload kiosk APK
- `npm run release:portal -- --version X.Y.Z` - Build, sign, and upload portal APK

### Package-Specific

See individual package READMEs:

- [Backend README](./packages/backend/README.md)
- [Portal README](./packages/portal/README.md)

## Project Structure

```
carehub/
├── packages/
│   ├── backend/      # Express REST API
│   ├── portal/       # SvelteKit caretaker portal
│   ├── shared/       # Drizzle schema, shared types, WebRTC/WebSocket utilities, structured logger, UI logic
│   └── kiosk/        # SvelteKit kiosk app with Capacitor (Android)
├── docs/             # Project documentation
├── .env.example      # Environment template
└── docker-compose.yml # PostgreSQL database
```

### Backend Structure

- `src/routes/` - API endpoints
- `src/middleware/` - Express middleware (auth, request validation)
- `src/schemas/` - Zod validation schemas (one per domain)
- `src/services/` - Business logic (email)
- `src/db/` - Database connection

### Frontend Structure

- `src/routes/(app)/` - Protected application routes
- `src/routes/login/` - Authentication flow
- `src/lib/` - Reusable components (organized by domain under `components/`), utilities (`utils/`), and API client

## Troubleshooting

### Port Already in Use

If you see "EADDRINUSE" errors:

```bash
# Find process using the port
lsof -i :9390  # or :9391, :9392

# Kill the process
kill -9 <PID>
```

Or use different ports by updating `.env`:

```
PORT=3001  # Backend port
```

And `packages/portal/vite.config.ts` for portal.

### JWT_SECRET Not Loading

The backend loads environment variables from the **working directory**, not the package directory.

**Solution**: Create a symlink in the backend package:

```bash
cd packages/backend
ln -s ../../.env .env
```

Or always run from the project root using workspace commands.

### Database Connection Issues

1. **Check Docker is running**

   ```bash
   docker ps
   ```

2. **Verify database is accessible**

   ```bash
   docker compose logs db
   ```

3. **Reset database**

   ```bash
   npm run db:down
   npm run db:up
   cd packages/shared && npm run db:migrate
   ```

4. **Check DATABASE_URL** matches Docker port (9392)

### ts-node vs tsx for Workspace Module Resolution

The backend uses `tsx` instead of `ts-node` to properly resolve npm workspace packages (`@carehub/shared`).

- ✅ `tsx` - Supports workspace dependencies
- ❌ `ts-node` - Has issues with workspace module resolution

The `dev` script uses: `nodemon --exec tsx src/index.ts`

## Getting Help

For detailed documentation, see:

- [Roadmap](./ROADMAP.md) - Project milestones and progress tracking
- [Architecture Documentation](./docs/architecture.md)
- [Features](./docs/features.md)
- [Releasing Android APKs](./RELEASING.md) - Build, sign, and upload pipeline
