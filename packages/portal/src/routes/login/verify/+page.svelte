<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { verifyOtp, requestOtp, getMe } from '$lib/api';

	const RESEND_COOLDOWN = 60;

	const email = $derived(page.url.searchParams.get('email') ?? '');

	let code = $state('');
	let error = $state('');
	let loading = $state(false);

	// Resend cooldown
	let cooldown = $state(RESEND_COOLDOWN);
	let resendLoading = $state(false);
	let resendError = $state('');
	let resendSuccess = $state(false);

	$effect(() => {
		if (cooldown <= 0) return;
		const id = setInterval(() => {
			cooldown -= 1;
			if (cooldown <= 0) clearInterval(id);
		}, 1000);
		return () => clearInterval(id);
	});

	async function handleVerify(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			await verifyOtp(email, code.trim());

			// Check if profile is set up
			const me = await getMe();
			if (!me.first_name) {
				await goto('/login/setup');
			} else {
				await goto('/');
			}
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Verification failed. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleResend() {
		resendError = '';
		resendSuccess = false;
		resendLoading = true;

		try {
			await requestOtp(email);
			cooldown = RESEND_COOLDOWN;
			resendSuccess = true;
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			resendError = apiErr?.message ?? 'Could not resend code. Please try again.';
		} finally {
			resendLoading = false;
		}
	}
</script>

<main class="min-h-screen bg-background flex items-center justify-center p-unit-2">
	<div class="card max-w-md w-full">
		<h1 class="text-h1 font-semibold text-text-primary mb-unit-1">Check your email</h1>
		<p class="text-base text-text-secondary mb-unit-3">
			We sent a 6-digit code to <span class="font-medium text-text-primary">{email}</span>.
		</p>

		<form onsubmit={handleVerify} novalidate>
			<label for="code" class="block text-sm font-medium text-text-primary mb-1">
				One-time code
			</label>
			<input
				id="code"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				placeholder="123456"
				maxlength={6}
				bind:value={code}
				disabled={loading}
				required
				class="w-full px-3 py-3 border border-gray-300 rounded-card text-base text-text-primary
               bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
               disabled:opacity-50 mb-unit-2 tracking-widest text-center font-mono"
			/>

			{#if error}
				<p class="text-sm text-danger mb-unit-2" role="alert">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading || code.trim().length !== 6}
				class="w-full py-3 px-4 bg-primary text-white font-semibold rounded-card text-base
               hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-unit-3"
			>
				{loading ? 'Verifying…' : 'Verify'}
			</button>
		</form>

		<div class="flex flex-col gap-2 text-sm">
			<!-- Resend -->
			{#if cooldown > 0}
				<p class="text-text-secondary">
					Resend code in <span class="font-medium text-text-primary">{cooldown}s</span>
				</p>
			{:else}
				<button
					type="button"
					onclick={handleResend}
					disabled={resendLoading}
					class="text-primary hover:underline text-left disabled:opacity-50 w-fit"
				>
					{resendLoading ? 'Sending…' : 'Resend code'}
				</button>
			{/if}

			{#if resendSuccess}
				<p class="text-sm text-success" role="status">Code resent successfully.</p>
			{/if}
			{#if resendError}
				<p class="text-sm text-danger" role="alert">{resendError}</p>
			{/if}

			<!-- Different email -->
			<a href="/login" class="text-primary hover:underline w-fit">Use a different email</a>
		</div>
	</div>
</main>
