<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getDeviceInfo, type Profile } from '$lib/services/api';
	import { getDeviceCredentials } from '$lib/services/storage';
	import ProfileCard from '$lib/components/ProfileCard.svelte';

	let profiles = $state<Profile[]>([]);
	let isLoading = $state(true);
	let greeting = $state('');
	let currentTime = $state('');
	let currentDate = $state('');
	let timeIntervalId: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		updateTimeDisplay();
		timeIntervalId = setInterval(updateTimeDisplay, 1000);

		const creds = await getDeviceCredentials();
		if (!creds) {
			goto('/pairing');
			return;
		}

		try {
			const info = await getDeviceInfo();
			if (!info.pairedAt) {
				goto('/pairing');
				return;
			}

			profiles = info.profiles;

			// If single profile, redirect
			if (profiles.length === 1) {
				goto(`/profile/${profiles[0].id}`);
				return;
			}

			isLoading = false;
		} catch {
			goto('/pairing');
		}
	});

	function updateTimeDisplay() {
		const now = new Date();
		const hour = now.getHours();

		if (hour < 12) {
			greeting = 'Good morning';
		} else if (hour < 17) {
			greeting = 'Good afternoon';
		} else {
			greeting = 'Good evening';
		}

		currentTime = now.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});

		currentDate = now.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	function selectProfile(profile: Profile) {
		goto(`/profile/${profile.id}`);
	}

	onDestroy(() => {
		if (timeIntervalId) {
			clearInterval(timeIntervalId);
			timeIntervalId = null;
		}
	});
</script>

<div class="min-h-screen p-unit-4">
	<!-- Header with time -->
	<header class="text-center mb-unit-6">
		<p class="text-3xl font-bold text-text-primary">{greeting}</p>
		<p class="text-4xl font-bold text-primary mt-unit-2">{currentTime}</p>
		<p class="text-xl text-text-secondary mt-unit-1">{currentDate}</p>
	</header>

	{#if isLoading}
		<div class="flex items-center justify-center py-unit-8">
			<div
				class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"
			></div>
		</div>
	{:else if profiles.length === 0}
		<div class="text-center py-unit-8">
			<p class="text-2xl text-text-secondary mb-unit-4">No profiles assigned yet</p>
			<p class="text-lg text-text-secondary">
				Ask your caretaker to assign profiles to this device
			</p>
		</div>
	{:else}
		<div class="max-w-4xl mx-auto">
			<p class="text-2xl text-text-secondary text-center mb-unit-4">
				Who are you checking in on today?
			</p>
			<div class="grid grid-cols-2 gap-unit-4">
				{#each profiles as profile (profile.id)}
					<ProfileCard {profile} onclick={() => selectProfile(profile)} />
				{/each}
			</div>
		</div>
	{/if}
</div>
