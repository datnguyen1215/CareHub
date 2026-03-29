# CareHub

A healthcare management platform for managing profiles, medications, and care coordination.

## Overview

CareHub is a monorepo application built with:

- **Frontend**: SvelteKit 5 + Svelte 5 runes + TypeScript + Tailwind CSS
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: JWT via httpOnly cookies with OTP email login

The application uses SvelteKit for both the frontend UI and backend API routes (full-stack framework).

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

- **Frontend & API**: http://localhost:9390
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

- `PORT` - Application port (default: 9390)
- `NODE_ENV` - Environment mode (development/production)

## Port Configuration

| Service        | Port | URL                   |
| -------------- | ---- | --------------------- |
| Frontend & API | 9390 | http://localhost:9390 |
| Database       | 9392 | localhost:9392        |

## Available Commands

### Root Level

- `npm run dev` - Start all services concurrently (frontend and shared)
- `npm run db:up` - Start PostgreSQL database container
- `npm run db:down` - Stop PostgreSQL database container

### Package-Specific

See [Frontend README](./packages/frontend/README.md) for package-specific commands.

## Project Structure

```
carehub/
├── packages/
│   ├── frontend/     # SvelteKit full-stack application
│   ├── shared/       # Drizzle schema and shared types
│   └── mobile/       # (placeholder)
├── docs/             # Project documentation
├── .env.example      # Environment template
└── docker-compose.yml # PostgreSQL database
```

### Frontend Structure

- `src/routes/(app)/` - Protected application routes
- `src/routes/api/` - API endpoints (SvelteKit server routes)
- `src/routes/login/` - Authentication flow
- `src/lib/` - Reusable components and utilities
- `src/lib/server/` - Server-side code (database, auth, services)

## Troubleshooting

### Port Already in Use

If you see "EADDRINUSE" errors:

```bash
# Find process using the port
lsof -i :9390  # or :9392

# Kill the process
kill -9 <PID>
```

Or use different ports by updating `.env`:

```
PORT=3000  # Application port
```

And `packages/frontend/vite.config.ts` for frontend dev server.

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

## Getting Help

For detailed documentation, see:

- [Roadmap](./ROADMAP.md) - Project milestones and progress tracking
- [Architecture Documentation](./docs/design.md)
- [API Documentation](./docs/api.md)
- [Data Model](./docs/data-model.md)
