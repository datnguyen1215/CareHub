<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listProfiles, createProfile, type CareProfile, type CreateProfileInput } from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/error-utils';
	import ProfileModal from '$lib/ProfileModal.svelte';

	let profiles = $state<CareProfile[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let canRetry = $state(false);

	let showProfileModal = $state(false);

	async function loadData() {
		loading = true;
		loadError = '';
		canRetry = false;

		try {
			profiles = await listProfiles();
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

	function getInitial(name: string): string {
		return name.charAt(0).toUpperCase();
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
		<p class="text-text-secondary text-sm">Loading…</p>
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
			<p class="text-text-secondary mb-unit-2">Add your first care profile</p>
			<button
				onclick={openCreate}
				class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base hover:bg-blue-600 transition-colors"
			>
				+ Add Profile
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-unit-2">
			{#each profiles as profile (profile.id)}
				<button
					onclick={() => goto(`/profiles/${profile.id}`)}
					class="card text-left flex flex-col gap-1 hover:shadow-md transition-shadow active:opacity-90 w-full"
				>
					<!-- Avatar and Name row -->
					<div class="flex items-center gap-2 mb-1">
						<!-- Avatar -->
						<div
							class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden"
						>
							{#if profile.avatar_url}
								<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
							{:else}
								<span class="text-primary font-semibold text-sm">
									{getInitial(profile.name)}
								</span>
							{/if}
						</div>
						<!-- Name -->
						<h3 class="text-h3 font-semibold text-text-primary leading-tight truncate">
							{profile.name}
						</h3>
					</div>

					<!-- Relationship subtitle -->
					{#if profile.relationship}
						<p class="text-sm text-text-secondary capitalize">{profile.relationship}</p>
					{/if}

					<!-- Conditions badges -->
					{#if profile.conditions.length > 0}
						<div class="flex flex-wrap gap-1 mt-1">
							{#each profile.conditions.slice(0, 3) as condition}
								<span
									class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100 truncate max-w-full"
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

					<!-- Medication count -->
					<p class="text-xs text-text-secondary mt-auto pt-1">
						{#if !profile.medication_count}
							No medications
						{:else if profile.medication_count === 1}
							1 medication
						{:else}
							{profile.medication_count} medications
						{/if}
					</p>
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if showProfileModal}
	<ProfileModal profile={null} onSave={handleSave} onClose={closeProfileModal} />
{/if}
