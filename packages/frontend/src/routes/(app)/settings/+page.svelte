<script lang="ts">
	import { goto } from '$app/navigation';
	import { logout } from '$lib/api';
	import { getErrorMessage } from '$lib/error-utils';

	let logoutLoading = $state(false);
	let logoutError = $state('');

	async function handleLogout() {
		logoutError = '';
		logoutLoading = true;

		try {
			await logout();
			goto('/login');
		} catch (err: unknown) {
			logoutError = getErrorMessage(err, 'log out');
		} finally {
			logoutLoading = false;
		}
	}
</script>

<div class="max-w-lg mx-auto px-unit-3 py-unit-3">
	<h2 class="text-h2 font-semibold text-text-primary mb-unit-3">Settings</h2>

	<div class="card">
		<h3 class="text-h3 font-semibold text-text-primary mb-unit-2">Account</h3>

		{#if logoutError}
			<p class="text-danger text-sm mb-unit-2">{logoutError}</p>
		{/if}

		<button
			type="button"
			onclick={handleLogout}
			disabled={logoutLoading}
			class="bg-danger text-white rounded-card px-unit-3 py-unit-1 font-medium text-base hover:opacity-90 disabled:opacity-60 transition-opacity"
		>
			{logoutLoading ? 'Logging out…' : 'Logout'}
		</button>
	</div>
</div>
