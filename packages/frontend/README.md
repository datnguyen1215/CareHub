# CareHub Frontend

SvelteKit 5 full-stack application with Svelte 5 runes and Tailwind CSS.

## Overview

The frontend is a complete full-stack SvelteKit application that provides both the web interface and API endpoints for managing healthcare profiles and medications. Built with:

- **SvelteKit 5** - Full-stack framework (frontend + backend)
- **Svelte 5 runes** - Fine-grained reactivity
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Drizzle ORM** - Database access
- **PostgreSQL** - Database

## Setup

### Prerequisites

- Node.js v16+
- Docker (for PostgreSQL database)

### Environment Variables

Create a `.env` file in the **project root** with the database connection and SMTP settings (see `.env.example`).

### Installation

From project root:

```bash
npm install
```

## Available Scripts

From this directory:

- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run Svelte type checking
- `npm run check:watch` - Watch mode for type checking
- `npm run lint` - Run ESLint and Prettier checks
- `npm run format` - Format code with Prettier

From project root:

- `npm run dev --workspace=packages/frontend` - Start frontend only
- `npm run dev` - Start all services (frontend + shared)

## Tech Stack

- **SvelteKit 5** - Full-stack Svelte framework
- **Svelte 5** - Reactive UI framework with runes API
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **@sveltejs/adapter-node** - Production adapter

## Development

### Running the App

1. Start the database (from root):

   ```bash
   npm run db:up
   ```

2. Run database migrations (from root):

   ```bash
   cd packages/shared && npm run db:migrate && cd ../..
   ```

3. Start the development server (from root):

   ```bash
   npm run dev
   ```

The app will be available at: **http://localhost:9390**

API routes are available at: **http://localhost:9390/api/**

### Port Configuration

The frontend runs on port **9390** (configured in `vite.config.ts`).

To change the port, edit `vite.config.ts`:

```typescript
export default defineConfig({
	server: {
		port: 5173 // Change to desired port
	}
});
```

## Project Structure

```
packages/frontend/
├── src/
│   ├── routes/               # SvelteKit routes
│   │   ├── (app)/           # Protected routes (requires auth)
│   │   │   ├── +layout.svelte   # App layout with navigation
│   │   │   ├── +page.svelte     # Dashboard
│   │   │   └── profiles/        # Profile management
│   │   ├── api/             # API endpoints (server routes)
│   │   │   ├── auth/        # Authentication endpoints
│   │   │   ├── users/       # User endpoints
│   │   │   ├── groups/      # Group endpoints
│   │   │   ├── profiles/    # Profile endpoints
│   │   │   └── medications/ # Medication endpoints
│   │   └── login/           # Authentication flow
│   │       └── +page.svelte     # OTP login
│   ├── lib/                  # Reusable code
│   │   ├── components/      # Svelte components
│   │   ├── server/          # Server-side code (DB, auth, services)
│   │   └── api.ts           # API client utilities
│   └── app.html              # HTML template
├── static/                   # Static assets
├── svelte.config.js          # SvelteKit configuration
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
└── package.json
```

### Route Structure

**Frontend Routes:**

- `/login` - OTP authentication flow
- `/` (protected) - Dashboard
- `/profiles` (protected) - Profile list and management
- `/profiles/:id` (protected) - Profile details and medications

All routes under `(app)` require authentication and redirect to `/login` if not authenticated.

**API Routes:**

- `/api/auth/*` - Authentication endpoints (login, verify, logout)
- `/api/users/*` - User management endpoints
- `/api/groups/*` - Group/household management
- `/api/profiles/*` - Care recipient profiles
- `/api/medications/*` - Medication tracking

## API Integration

The application uses SvelteKit's server routes for API endpoints. All API routes are in the same application, so no CORS configuration is needed.

Client-side code can make API requests using standard `fetch`:

```typescript
// Example API call
const response = await fetch('/api/users/me', {
	method: 'GET',
	credentials: 'include' // Include httpOnly cookies
});

const user = await response.json();
```

Authentication tokens are stored in httpOnly cookies and automatically included in requests.

## Styling

The app uses **Tailwind CSS** for styling. Customize the theme in `tailwind.config.js`.

Common utility classes:

- `btn` - Button styles
- `card` - Card container
- `input` - Form inputs

## Type Safety

The frontend uses TypeScript with types from `@carehub/shared` package:

```typescript
import type { User, Profile, Medication } from '@carehub/shared';
```

Run type checking:

```bash
npm run check
```

## Building for Production

1. Build the app:

   ```bash
   npm run build
   ```

2. Preview the build:
   ```bash
   npm run preview
   ```

The production build is optimized and uses the Node adapter for deployment.

## Troubleshooting

### Port Already in Use

**Symptom**: "Port 9390 is already in use"

**Solution**:

```bash
# Find process
lsof -i :9390

# Kill process
kill -9 <PID>

# Or change port in vite.config.ts
```

### API Connection Failed

**Symptom**: API requests failing with 404 or 500 errors

**Solution**:

1. Verify dev server is running: `npm run dev`
2. Check API endpoint exists in `src/routes/api/`
3. Check server console for errors
4. Verify database connection in `.env` (DATABASE_URL)

### Authentication Issues

**Symptom**: Redirecting to login repeatedly, auth not persisting

**Solution**:

1. Check browser allows cookies (not in incognito without cookies)
2. Verify API requests include `credentials: 'include'`
3. Check JWT_SECRET is set in `.env`
4. Verify SMTP settings for OTP email delivery
5. Clear cookies and try again

### Hot Reload Not Working

**Symptom**: Changes not reflecting in browser

**Solution**:

1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Check Vite dev server console for errors
3. Restart dev server: `Ctrl+C` then `npm run dev`

### Type Errors After Package Updates

**Symptom**: TypeScript errors after updating dependencies

**Solution**:

```bash
# Rebuild shared package
npm run build --workspace=packages/shared

# Re-run type checking
npm run check
```

## Development Tips

### Svelte 5 Runes

This app uses Svelte 5 runes syntax for reactivity:

```svelte
<script lang="ts">
	// State
	let count = $state(0);

	// Derived state
	let doubled = $derived(count * 2);

	// Effects
	$effect(() => {
		console.log('Count changed:', count);
	});
</script>
```

Avoid deprecated Svelte features:

- ❌ `export let prop` → ✅ `let { prop } = $props()`
- ❌ `$:` reactive statements → ✅ `$derived()`
- ❌ `onMount` for side effects → ✅ `$effect()`

### SvelteKit Navigation

Use SvelteKit's built-in navigation:

```svelte
<script>
	import { goto } from '$app/navigation';

	function navigate() {
		goto('/profiles');
	}
</script>

<!-- Or use anchor tags for navigation -->
<a href="/profiles">Profiles</a>
```

### API Error Handling

Handle API errors gracefully:

```typescript
try {
	const response = await apiRequest('/api/users/me');
	if (!response.ok) {
		const error = await response.json();
		console.error('API Error:', error.message);
	}
	const user = await response.json();
} catch (error) {
	console.error('Network error:', error);
}
```

## Testing

Tests can be added using Vitest and Testing Library:

```bash
npm install -D vitest @testing-library/svelte
```

(Testing setup not currently configured - see [testing docs](../../docs/testing.md) for setup guide)

## Learn More

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Project Documentation](../../docs/)
