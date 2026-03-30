# CareHub Frontend

SvelteKit 5 application with Svelte 5 runes and Tailwind CSS.

## Overview

The frontend provides a modern web interface for managing healthcare profiles and medications. Built with:

- **SvelteKit 5** - Full-stack framework
- **Svelte 5 runes** - Fine-grained reactivity
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type safety
- **Vite** - Fast build tool

## Setup

### Prerequisites

- Node.js v16+
- Backend API running (see [backend README](../backend/README.md))

### Environment Variables

Create a `.env` file in the **project root** with:

```bash
# Frontend (loaded by Vite)
VITE_API_URL=http://localhost:9391
```

Or use the backend's default URL (`http://localhost:9391`) which is used if not specified.

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
- `npm run dev` - Start all services (frontend + backend + shared)

## Tech Stack

- **SvelteKit 5** - Full-stack Svelte framework
- **Svelte 5** - Reactive UI framework with runes API
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **@sveltejs/adapter-node** - Production adapter

## Development

### Running the App

1. Start backend and database (from root):

   ```bash
   npm run db:up
   npm run dev --workspace=packages/backend
   ```

2. Start frontend (from root):

   ```bash
   npm run dev --workspace=packages/frontend
   ```

3. Or start everything at once (from root):
   ```bash
   npm run dev
   ```

The app will be available at: **http://localhost:9390**

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
│   │   │   ├── +layout.svelte   # App layout with navigation and toast
│   │   │   ├── +page.svelte     # Dashboard
│   │   │   └── profiles/        # Profile management
│   │   └── login/           # Authentication flow
│   │       └── +page.svelte     # OTP login
│   ├── lib/                  # Reusable code
│   │   ├── components/      # Svelte components
│   │   ├── Toast.svelte     # Toast notification component
│   │   ├── api.ts           # API client for backend
│   │   └── stores/
│   │       └── toast.ts     # Toast notification store
│   └── app.html              # HTML template
├── static/                   # Static assets
├── svelte.config.js          # SvelteKit configuration
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
└── package.json
```

### Route Structure

- `/login` - OTP authentication flow
- `/` (protected) - Dashboard
- `/profiles` (protected) - Profile list and management
- `/profiles/:id` (protected) - Profile details and medications

All routes under `(app)` require authentication and redirect to `/login` if not authenticated.

## API Integration

The frontend communicates with the backend API using `fetch` with credentials:

```typescript
// src/lib/api.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9391';

export async function apiRequest(endpoint: string, options?: RequestInit) {
	const response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		credentials: 'include' // Send httpOnly cookies
	});
	return response;
}
```

Authentication tokens are stored in httpOnly cookies by the backend.

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

**Symptom**: API requests failing, CORS errors

**Solution**:

1. Verify backend is running: `curl http://localhost:9391/api/health`
2. Check `VITE_API_URL` environment variable
3. Ensure backend `FRONTEND_URL` in .env matches frontend URL
4. Check browser console for error details

### Authentication Issues

**Symptom**: Redirecting to login repeatedly, auth not persisting

**Solution**:

1. Check browser allows cookies (not in incognito without cookies)
2. Verify API requests include `credentials: 'include'`
3. Check backend JWT_SECRET is set
4. Clear cookies and try again

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

### Toast Notifications

The app includes a toast notification system for user feedback on actions.

**Usage:**

```svelte
<script lang="ts">
	import { toast } from '$lib/stores/toast';

	async function handleSave() {
		try {
			await saveData();
			toast.success('Data saved'); // Auto-dismisses after 3s
		} catch (err) {
			toast.error('Failed to save'); // Manual dismiss required
		}
	}

	async function handleDelete() {
		await deleteData();
		toast.destructive('Item deleted'); // Auto-dismisses after 3s
	}
</script>
```

**Toast Types:**

- `toast.success(message)` - Green toast with checkmark icon, auto-dismisses after 3 seconds
- `toast.error(message)` - Red toast with exclamation icon, requires manual dismiss
- `toast.destructive(message)` - Red toast with X icon for delete actions, auto-dismisses after 3 seconds
- `toast.dismiss(id)` - Manually dismiss a specific toast by ID

**Guidelines:**

- Keep messages short: "Profile saved" not "Your profile has been saved successfully"
- Include item names when helpful: "Metformin added" > "Medication added"
- Use success for create/update operations
- Use destructive for delete operations
- Use error for failures that need user attention

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
- [Backend API Documentation](../backend/README.md)
- [Project Documentation](../../docs/)
