<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listGroups,
		listProfiles,
		createProfile,
		updateProfile,
		deleteProfile,
		type CareProfile,
		type CreateProfileInput
	} from '$lib/api';
	import ProfileModal from '$lib/ProfileModal.svelte';
	import DeleteConfirmModal from '$lib/DeleteConfirmModal.svelte';

	let groupId = $state<string | null>(null);
	let profiles = $state<CareProfile[]>([]);
	let loadError = $state('');
	let loading = $state(true);

	// Modal state
	let showProfileModal = $state(false);
	let editingProfile = $state<CareProfile | null>(null);
	let deletingProfile = $state<CareProfile | null>(null);

	onMount(async () => {
		try {
			const groups = await listGroups();
			if (groups.length === 0) {
				loadError = 'No group found. Please complete setup first.';
				return;
			}
			groupId = groups[0].id;
			profiles = await listProfiles(groupId);
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				window.location.href = '/login';
				return;
			}
			loadError = 'Failed to load profiles.';
		} finally {
			loading = false;
		}
	});

	function openCreate() {
		editingProfile = null;
		showProfileModal = true;
	}

	function openEdit(profile: CareProfile) {
		editingProfile = profile;
		showProfileModal = true;
	}

	function openDelete(profile: CareProfile) {
		deletingProfile = profile;
	}

	function closeProfileModal() {
		showProfileModal = false;
		editingProfile = null;
	}

	function closeDeleteModal() {
		deletingProfile = null;
	}

	async function handleSave(data: CreateProfileInput) {
		if (!groupId) return;

		if (editingProfile) {
			const updated = await updateProfile(groupId, editingProfile.id, data);
			profiles = profiles.map((p) => (p.id === updated.id ? updated : p));
		} else {
			const created = await createProfile(groupId, data);
			profiles = [...profiles, created];
		}
		closeProfileModal();
	}

	async function handleDelete() {
		if (!groupId || !deletingProfile) return;
		await deleteProfile(groupId, deletingProfile.id);
		profiles = profiles.filter((p) => p.id !== deletingProfile!.id);
		closeDeleteModal();
	}
</script>

<main class="min-h-screen bg-background p-unit-3">
	<div class="max-w-2xl mx-auto">
		<div class="flex items-center justify-between mb-unit-3">
			<h1 class="text-h1 font-semibold text-text-primary">Care Profiles</h1>
			{#if groupId}
				<button
					onclick={openCreate}
					class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base
					       hover:bg-blue-600 transition-colors"
				>
					+ Add Profile
				</button>
			{/if}
		</div>

		{#if loading}
			<p class="text-text-secondary">Loading…</p>
		{:else if loadError}
			<div class="card">
				<p class="text-danger">{loadError}</p>
			</div>
		{:else if profiles.length === 0}
			<div class="card text-center py-unit-4">
				<p class="text-text-secondary mb-unit-2">No profiles yet.</p>
				<button
					onclick={openCreate}
					class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base
					       hover:bg-blue-600 transition-colors"
				>
					+ Add Profile
				</button>
			</div>
		{:else}
			<div class="grid gap-unit-2 sm:grid-cols-2">
				{#each profiles as profile (profile.id)}
					<div class="card flex flex-col gap-1">
						<div class="flex items-start justify-between">
							<h2 class="text-h3 font-semibold text-text-primary">{profile.name}</h2>
							<div class="flex gap-2 ml-unit-2 shrink-0">
								<button
									onclick={() => openEdit(profile)}
									class="text-sm text-primary hover:underline"
									aria-label="Edit {profile.name}"
								>
									Edit
								</button>
								<button
									onclick={() => openDelete(profile)}
									class="text-sm text-danger hover:underline"
									aria-label="Delete {profile.name}"
								>
									Delete
								</button>
							</div>
						</div>

						{#if profile.relationship}
							<p class="text-sm text-text-secondary capitalize">{profile.relationship}</p>
						{/if}

						{#if profile.date_of_birth}
							<p class="text-sm text-text-secondary">DOB: {profile.date_of_birth}</p>
						{/if}

						{#if profile.conditions.length > 0}
							<div class="flex flex-wrap gap-1 mt-1">
								{#each profile.conditions as condition}
									<span
										class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100"
									>
										{condition}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</main>

{#if showProfileModal && groupId}
	<ProfileModal
		{groupId}
		profile={editingProfile}
		onSave={handleSave}
		onClose={closeProfileModal}
	/>
{/if}

{#if deletingProfile}
	<DeleteConfirmModal
		name={deletingProfile.name}
		onConfirm={handleDelete}
		onClose={closeDeleteModal}
	/>
{/if}
