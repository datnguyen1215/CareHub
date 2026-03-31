<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getDeviceInfo, type Profile, type Caretaker } from '$lib/services/api';
	import { getDeviceCredentials } from '$lib/services/storage';
	import CaretakerCard from '$lib/components/CaretakerCard.svelte';

	let profile = $state<Profile | null>(null);
	let caretakers = $state<Caretaker[]>([]);
	let allProfiles = $state<Profile[]>([]);
	let isLoading = $state(true);
	let greeting = $state('');
	let currentTime = $state('');
	let currentDate = $state('');
	let timeIntervalId: ReturnType<typeof setInterval> | null = null;

	const profileId = $derived(page.params.id);

	onMount(async () => {
		updateTimeDisplay();
		timeIntervalId = setInterval(updateTimeDisplay, 1000);

		const creds = getDeviceCredentials();
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

			allProfiles = info.profiles;
			caretakers = info.caretakers;

			// Find the selected profile
			profile = info.profiles.find((p) => p.id === profileId) || null;

			if (!profile) {
				// Profile not found or not assigned
				goto('/home');
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

	function initiateCall(caretaker: Caretaker) {
		// TODO: Implement video calling in Phase 3.5
		alert(`Calling ${caretaker.first_name || caretaker.email}... (Coming soon)`);
	}

	function goBack() {
		goto('/home');
	}

	onDestroy(() => {
		if (timeIntervalId) {
			clearInterval(timeIntervalId);
			timeIntervalId = null;
		}
	});
</script>

<div class="min-h-screen p-unit-4">
	<!-- Back button (only show if multiple profiles) -->
	{#if allProfiles.length > 1}
		<button
			class="flex items-center gap-2 text-primary mb-unit-4 min-h-[60px] min-w-[60px]"
			onclick={goBack}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="w-8 h-8"
			>
				<path
					fill-rule="evenodd"
					d="M7.28 7.72a.75.75 0 0 1 0 1.06l-2.47 2.47H21a.75.75 0 0 1 0 1.5H4.81l2.47 2.47a.75.75 0 1 1-1.06 1.06l-3.75-3.75a.75.75 0 0 1 0-1.06l3.75-3.75a.75.75 0 0 1 1.06 0Z"
					clip-rule="evenodd"
				/>
			</svg>
			<span class="text-xl">Back</span>
		</button>
	{/if}

	{#if isLoading}
		<div class="flex items-center justify-center py-unit-8">
			<div
				class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"
			></div>
		</div>
	{:else if profile}
		<!-- Greeting header -->
		<header class="text-center mb-unit-6">
			<p class="text-3xl font-bold text-text-primary">
				{greeting}, {profile.name}!
			</p>
			<p class="text-4xl font-bold text-primary mt-unit-2">{currentTime}</p>
			<p class="text-xl text-text-secondary mt-unit-1">{currentDate}</p>
		</header>

		<div class="max-w-2xl mx-auto">
			<!-- Caretakers section -->
			<section class="mb-unit-6">
				<h2 class="text-2xl font-semibold text-text-primary mb-unit-3">Your Caretakers</h2>
				{#if caretakers.length === 0}
					<div class="kiosk-card text-center py-unit-4">
						<p class="text-xl text-text-secondary">No caretakers available</p>
					</div>
				{:else}
					<div class="space-y-unit-3">
						{#each caretakers as caretaker (caretaker.id)}
							<CaretakerCard {caretaker} onclick={() => initiateCall(caretaker)} />
						{/each}
					</div>
				{/if}
			</section>

			<!-- Today's appointments section (placeholder) -->
			<section>
				<h2 class="text-2xl font-semibold text-text-primary mb-unit-3">Today's Schedule</h2>
				<div class="kiosk-card text-center py-unit-4">
					<p class="text-xl text-text-secondary">No appointments today</p>
				</div>
			</section>
		</div>
	{/if}
</div>
