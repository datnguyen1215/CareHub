<script lang="ts">
	import { page } from '$app/stores';

	/**
	 * Error display convention for authenticated routes:
	 *
	 * - API errors on page load     → inline error message with retry button (this file catches unhandled errors)
	 * - API errors on user action   → toast notification (save, delete, create)
	 * - Validation errors           → inline field-level messages
	 * - Unhandled route errors      → this error boundary
	 */

	let status = $derived($page.status);
	let error = $derived($page.error);

	function getMessage(code: number | undefined): string {
		if (code === 404) return "The page you're looking for doesn't exist.";
		if (code === 403) return "You don't have permission to view this page.";
		if (code === 401) return 'Your session has expired. Please log in again.';
		if (code && code >= 500) return 'Something went wrong on our end. Please try again.';
		return 'An unexpected error occurred.';
	}
</script>

<svelte:head>
	<title>Error — CareHub</title>
</svelte:head>

<div class="max-w-md mx-auto px-unit-3 py-unit-4 text-center">
	<!-- Error icon -->
	<div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-unit-3">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			class="w-8 h-8 text-danger"
			aria-hidden="true"
		>
			<path
				fill-rule="evenodd"
				d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
				clip-rule="evenodd"
			/>
		</svg>
	</div>

	<h1 class="text-h2 font-semibold text-text-primary mb-unit-1">
		{status ? `Error #${status}` : 'Something went wrong'}
	</h1>

	<p class="text-text-secondary mb-unit-3">
		{getMessage(status)}
	</p>

	{#if error?.message && error.message !== getMessage(status)}
		<p class="text-sm text-text-secondary bg-gray-50 rounded-card p-unit-2 mb-unit-3 font-mono">
			{error.message}
		</p>
	{/if}

	<div class="flex gap-unit-2 justify-center">
		<button
			onclick={() => history.back()}
			class="px-unit-3 py-2 rounded-card border border-gray-300 text-text-primary font-semibold
			       hover:bg-gray-50 transition-colors"
		>
			Go back
		</button>
		<a
			href="/"
			class="px-unit-3 py-2 rounded-card bg-primary text-white font-semibold
			       hover:bg-blue-600 transition-colors"
		>
			Go home
		</a>
	</div>
</div>
