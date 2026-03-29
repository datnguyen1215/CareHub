<script lang="ts">
	import { goto } from '$app/navigation';
	import { requestOtp } from '$lib/api';

	let email = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			await requestOtp(email.trim());
			await goto(`/login/verify?email=${encodeURIComponent(email.trim())}`);
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<main class="min-h-screen bg-background flex items-center justify-center p-unit-2">
	<div class="card max-w-md w-full">
		<h1 class="text-h1 font-semibold text-text-primary mb-unit-1">Sign in</h1>
		<p class="text-base text-text-secondary mb-unit-3">
			Enter your email and we'll send you a one-time code.
		</p>

		<form onsubmit={handleSubmit} novalidate>
			<label for="email" class="block text-sm font-medium text-text-primary mb-1">
				Email address
			</label>
			<input
				id="email"
				type="email"
				autocomplete="email"
				placeholder="you@example.com"
				bind:value={email}
				disabled={loading}
				required
				class="w-full px-3 py-3 border border-gray-300 rounded-card text-base text-text-primary
               bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
               disabled:opacity-50 mb-unit-2"
			/>

			{#if error}
				<p class="text-sm text-danger mb-unit-2" role="alert">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading || !email.trim()}
				class="w-full py-3 px-4 bg-primary text-white font-semibold rounded-card text-base
               hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Sending…' : 'Send Code'}
			</button>
		</form>
	</div>
</main>
