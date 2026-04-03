<script lang="ts">
	import { goto } from '$app/navigation';
	import { updateMe } from '$lib/api';
	import { toast } from '$lib/stores/toast.svelte';

	let firstName = $state('');
	let lastName = $state('');
	let error = $state('');
	let loading = $state(false);

	const canSubmit = $derived(firstName.trim().length > 0 && lastName.trim().length > 0 && !loading);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			// Update user profile
			await updateMe({ first_name: firstName.trim(), last_name: lastName.trim() });

			// Show welcome toast before redirect
			toast.success('Welcome to CareHub!');

			// Redirect to dashboard
			await goto('/');
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Could not save your details. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<main class="min-h-screen bg-background flex items-center justify-center p-unit-2">
	<div class="card max-w-md w-full">
		<h1 class="text-h1 font-semibold text-text-primary mb-unit-1">Set up your account</h1>
		<p class="text-base text-text-secondary mb-unit-3">Tell us your name to get started.</p>

		<form onsubmit={handleSubmit} novalidate>
			<div class="mb-unit-2">
				<label for="first-name" class="block text-sm font-medium text-text-primary mb-1">
					First name
				</label>
				<input
					id="first-name"
					type="text"
					autocomplete="given-name"
					placeholder="Jane"
					bind:value={firstName}
					disabled={loading}
					required
					class="w-full px-3 py-3 border border-gray-300 rounded-card text-base text-text-primary
                 bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                 disabled:opacity-50"
				/>
			</div>

			<div class="mb-unit-2">
				<label for="last-name" class="block text-sm font-medium text-text-primary mb-1">
					Last name
				</label>
				<input
					id="last-name"
					type="text"
					autocomplete="family-name"
					placeholder="Doe"
					bind:value={lastName}
					disabled={loading}
					required
					class="w-full px-3 py-3 border border-gray-300 rounded-card text-base text-text-primary
                 bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                 disabled:opacity-50"
				/>
			</div>

			{#if error}
				<p class="text-sm text-danger mb-unit-2" role="alert">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={!canSubmit}
				class="w-full py-3 px-4 bg-primary text-white font-semibold rounded-card text-base
               hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Saving…' : 'Continue'}
			</button>
		</form>
	</div>
</main>
