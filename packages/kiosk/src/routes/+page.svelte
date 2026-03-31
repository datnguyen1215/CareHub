<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getDeviceCredentials } from '$lib/services/storage';
	import { getDeviceInfo } from '$lib/services/api';

	let isLoading = $state(true);

	onMount(async () => {
		const creds = getDeviceCredentials();

		if (!creds) {
			goto('/pairing');
			return;
		}

		try {
			const info = await getDeviceInfo();

			if (!info.pairedAt) {
				goto('/pairing');
			} else if (info.profiles.length === 1) {
				goto(`/profile/${info.profiles[0].id}`);
			} else {
				goto('/home');
			}
		} catch {
			goto('/pairing');
		}
	});
</script>

{#if isLoading}
	<div class="min-h-screen flex items-center justify-center">
		<div class="text-center">
			<div
				class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"
			></div>
			<p class="text-xl text-text-secondary">Loading...</p>
		</div>
	</div>
{/if}
