<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		listProfiles,
		createProfile,
		listDevices,
		type CareProfile,
		type CreateProfileInput,
		type Device
	} from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/utils/error-utils';
	import ProfileModal from '$lib/components/profiles/ProfileModal.svelte';
	import { getInitial } from '$lib/utils/format';

	let profiles = $state<CareProfile[]>([]);
	let devices = $state<Device[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let canRetry = $state(false);

	let showProfileModal = $state(false);

	/** Returns device info for a profile: device name and status */
	function getProfileDeviceInfo(
		profileId: string
	): { name: string; status: 'online' | 'offline' } | null {
		const profileDevices = devices.filter((d) => d.profiles.some((p) => p.id === profileId));
		if (profileDevices.length === 0) return null;
		// Find first online device, or fall back to first device
		const onlineDevice = profileDevices.find((d) => d.status === 'online');
		const device = onlineDevice ?? profileDevices[0];
		return {
			name: device.name,
			status: profileDevices.some((d) => d.status === 'online') ? 'online' : 'offline'
		};
	}

	async function loadData() {
		loading = true;
		loadError = '';
		canRetry = false;

		try {
			const [profilesData, devicesData] = await Promise.all([listProfiles(), listDevices()]);
			profiles = profilesData;
			devices = devicesData;
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			loadError = getErrorMessage(err, 'load profiles');
			canRetry = isRetryable(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	function openCreate() {
		showProfileModal = true;
	}

	function closeProfileModal() {
		showProfileModal = false;
	}

	async function handleSave(data: CreateProfileInput) {
		const created = await createProfile(data);
		profiles = [...profiles, created];
		closeProfileModal();
	}

</script>

<div class="max-w-2xl mx-auto px-unit-3 py-unit-3">
	<div class="flex items-center justify-between mb-unit-3">
		<h2 class="text-h2 font-semibold text-text-primary">Care Profiles</h2>
		{#if profiles.length > 0}
			<button
				onclick={openCreate}
				class="bg-primary text-white rounded-card px-unit-2 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
			>
				+ Add
			</button>
		{/if}
	</div>

	{#if loading}
		<!-- Loading skeleton -->
		<div class="flex flex-col gap-unit-2" aria-label="Loading profiles">
			{#each Array(3) as _}
				<div class="card flex items-center gap-3 animate-pulse">
					<div class="w-12 h-12 rounded-full bg-gray-200 shrink-0"></div>
					<div class="flex-1 space-y-2">
						<div class="h-4 bg-gray-200 rounded w-1/3"></div>
						<div class="h-3 bg-gray-200 rounded w-1/2"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div class="card">
			<p class="text-danger text-sm mb-unit-2">{loadError}</p>
			{#if canRetry}
				<button
					onclick={loadData}
					class="bg-primary text-white rounded-card px-unit-3 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
				>
					Retry
				</button>
			{/if}
		</div>
	{:else if profiles.length === 0}
		<div class="card text-center py-unit-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="w-12 h-12 text-gray-300 mx-auto mb-unit-2"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 1 1-1.49-.156 5.25 5.25 0 0 0-10.438 0 .75.75 0 0 1-1.49.157 6.745 6.745 0 0 1 .019-.482Z"
					clip-rule="evenodd"
				/>
				<path
					d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.366-1.764.441Z"
				/>
			</svg>
			<h3 class="text-lg font-semibold text-text-primary mb-unit-1">Get started with CareHub</h3>
			<p class="text-text-secondary mb-unit-2">
				Create a profile for someone you care for. You'll be able to track their medications,
				appointments, and health notes.
			</p>
			<button
				onclick={openCreate}
				class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base hover:bg-blue-600 transition-colors"
			>
				+ Add Profile
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-unit-2">
			{#each profiles as profile (profile.id)}
				{@const deviceInfo = getProfileDeviceInfo(profile.id)}
				<button
					onclick={() => goto(`/profiles/${profile.id}`)}
					class="card text-left flex items-center gap-3 hover:shadow-md transition-shadow active:opacity-90 w-full"
				>
					<!-- Avatar -->
					<div
						class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden"
					>
						{#if profile.avatar_url}
							<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
						{:else}
							<span class="text-primary font-semibold text-base">
								{getInitial(profile.name)}
							</span>
						{/if}
					</div>

					<!-- Info section -->
					<div class="flex-1 min-w-0">
						<!-- Name -->
						<h3 class="text-h3 font-semibold text-text-primary leading-tight">
							{profile.name}
						</h3>

						<!-- Relationship and medication count -->
						<p class="text-sm text-text-secondary">
							{#if profile.relationship}
								<span class="capitalize">{profile.relationship}</span>
								<span class="mx-1">·</span>
							{/if}
							{#if !profile.medication_count}
								No medications
							{:else if profile.medication_count === 1}
								1 medication
							{:else}
								{profile.medication_count} medications
							{/if}
						</p>

						<!-- Device status -->
						{#if deviceInfo}
							<p
								class="text-xs text-text-secondary flex items-center gap-1 mt-0.5"
								title={deviceInfo.status === 'online' ? 'Device online' : 'Device offline'}
							>
								<span>📱</span>
								<span>{deviceInfo.name}</span>
								<span
									class="w-1.5 h-1.5 rounded-full {deviceInfo.status === 'online'
										? 'bg-green-500'
										: 'bg-gray-400'}"
								></span>
							</p>
						{/if}

						<!-- Conditions badges -->
						{#if profile.conditions.length > 0}
							<div class="flex flex-wrap gap-1 mt-1.5">
								{#each profile.conditions.slice(0, 3) as condition}
									<span
										class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100"
									>
										{condition}
									</span>
								{/each}
								{#if profile.conditions.length > 3}
									<span class="text-xs text-text-secondary"
										>+{profile.conditions.length - 3} more</span
									>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Chevron -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-5 h-5 text-text-secondary shrink-0"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if showProfileModal}
	<ProfileModal profile={null} onSave={handleSave} onClose={closeProfileModal} />
{/if}
