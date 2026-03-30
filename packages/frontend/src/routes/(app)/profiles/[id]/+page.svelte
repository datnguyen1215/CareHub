<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		listGroups,
		getProfile,
		updateProfile,
		listMedications,
		createMedication,
		updateMedication,
		type CareProfile,
		type Medication,
		type CreateProfileInput,
		type CreateMedicationInput
	} from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/error-utils';
	import ProfileModal from '$lib/ProfileModal.svelte';
	import MedicationModal from '$lib/MedicationModal.svelte';

	const profileId = $derived($page.params.id ?? '');

	let groupId = $state<string | null>(null);
	let profile = $state<CareProfile | null>(null);
	let recentMeds = $state<Medication[]>([]);
	let medications = $state<Medication[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let showDiscontinued = $state(false);
	let loadingMeds = $state(false);
	let canRetry = $state(false);
	let medError = $state('');

	let activeTab = $state<'overview' | 'meds'>('overview');
	let showEditModal = $state(false);
	let showMedModal = $state(false);
	let editingMedication = $state<Medication | null>(null);

	async function loadData() {
		loading = true;
		loadError = '';
		canRetry = false;

		try {
			const groups = await listGroups();
			if (groups.length === 0) {
				loadError = 'No group found. Please complete setup first.';
				return;
			}
			groupId = groups[0].id;
			const [profileData, medsData] = await Promise.all([
				getProfile(groupId, profileId),
				listMedications(groupId, profileId)
			]);
			profile = profileData;
			medications = medsData;
			recentMeds = medsData.filter((m) => m.status === 'active').slice(0, 3);
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			loadError = getErrorMessage(err, 'load profile');
			canRetry = isRetryable(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	function formatDate(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	async function handleEditSave(data: CreateProfileInput) {
		if (!groupId || !profile) return;
		const updated = await updateProfile(groupId, profile.id, data);
		profile = updated;
		showEditModal = false;
	}

	async function toggleDiscontinued() {
		if (!groupId) return;
		showDiscontinued = !showDiscontinued;
		loadingMeds = true;
		medError = '';
		try {
			medications = await listMedications(groupId, profileId, showDiscontinued);
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			medError = getErrorMessage(err, 'load medications');
			// Revert toggle state on error
			showDiscontinued = !showDiscontinued;
		} finally {
			loadingMeds = false;
		}
	}

	function openCreateMed() {
		editingMedication = null;
		showMedModal = true;
	}

	function openEditMed(med: Medication) {
		editingMedication = med;
		showMedModal = true;
	}

	function closeMedModal() {
		showMedModal = false;
		editingMedication = null;
	}

	async function handleMedSave(data: CreateMedicationInput) {
		if (!groupId) return;

		if (editingMedication) {
			const updated = await updateMedication(groupId, profileId, editingMedication.id, data);
			medications = medications.map((m) => (m.id === updated.id ? updated : m));
			if (!showDiscontinued && updated.status === 'discontinued') {
				medications = medications.filter((m) => m.id !== updated.id);
			}
		} else {
			const created = await createMedication(groupId, profileId, data);
			medications = [...medications, created];
		}

		// Refresh recent meds for overview tab
		recentMeds = medications.filter((m) => m.status === 'active').slice(0, 3);
		closeMedModal();
	}

	const SCHEDULE_LABELS: Record<string, string> = {
		morning: 'Morning',
		afternoon: 'Afternoon',
		evening: 'Evening',
		bedtime: 'Bedtime'
	};

	const activeMeds = $derived(medications.filter((m) => m.status === 'active'));
	const discontinuedMeds = $derived(medications.filter((m) => m.status === 'discontinued'));
</script>

<!-- Page-specific top bar (overrides the global TopBar for this page) -->
<div class="fixed top-0 left-0 right-0 bg-surface border-b border-gray-200 z-50">
	<div class="max-w-2xl mx-auto flex items-center justify-between px-unit-2 h-14">
		<!-- Back arrow -->
		<button
			onclick={() => goto('/')}
			class="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
			aria-label="Back to dashboard"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="w-5 h-5 text-text-primary"
				aria-hidden="true"
			>
				<path d="M15 18l-6-6 6-6" />
			</svg>
		</button>

		<!-- Profile name -->
		<span class="text-h3 font-semibold text-text-primary truncate flex-1 text-center px-2">
			{profile?.name ?? ''}
		</span>

		<!-- Edit button -->
		<button
			onclick={() => (showEditModal = true)}
			class="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
			aria-label="Edit profile"
			disabled={!profile}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="w-5 h-5 text-text-primary"
				aria-hidden="true"
			>
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	</div>
</div>

<!-- Spacer for fixed top bar -->
<div class="h-14"></div>

<!-- Tab bar -->
<div class="sticky top-14 z-40 bg-surface border-b border-gray-200">
	<div class="max-w-2xl mx-auto flex">
		<button
			onclick={() => (activeTab = 'overview')}
			class="flex-1 py-3 min-h-[44px] text-sm font-semibold transition-colors
				{activeTab === 'overview'
				? 'text-primary border-b-2 border-primary'
				: 'text-text-secondary hover:text-text-primary'}"
		>
			Overview
		</button>
		<button
			onclick={() => (activeTab = 'meds')}
			class="flex-1 py-3 min-h-[44px] text-sm font-semibold transition-colors
				{activeTab === 'meds'
				? 'text-primary border-b-2 border-primary'
				: 'text-text-secondary hover:text-text-primary'}"
		>
			Meds
		</button>
	</div>
</div>

<!-- Page content -->
<div class="max-w-2xl mx-auto px-unit-2 py-unit-3">
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
	{:else if activeTab === 'overview' && profile}
		<!-- Overview Tab -->

		<!-- Profile info card -->
		<div class="card mb-unit-2">
			<h2 class="text-h3 font-semibold text-text-primary mb-unit-2">{profile.name}</h2>

			<dl class="flex flex-col gap-1.5 text-sm">
				{#if profile.relationship}
					<div class="flex gap-2">
						<dt class="text-text-secondary w-28 shrink-0">Relationship</dt>
						<dd class="text-text-primary capitalize">{profile.relationship}</dd>
					</div>
				{/if}

				{#if profile.date_of_birth}
					<div class="flex gap-2">
						<dt class="text-text-secondary w-28 shrink-0">Date of birth</dt>
						<dd class="text-text-primary">{formatDate(profile.date_of_birth)}</dd>
					</div>
				{/if}
			</dl>

			{#if profile.conditions && profile.conditions.length > 0}
				<div class="mt-unit-2 flex flex-wrap gap-1.5">
					{#each profile.conditions as condition}
						<span
							class="text-xs bg-blue-50 text-primary rounded-full px-2.5 py-0.5 border border-blue-100"
						>
							{condition}
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Recent medications card -->
		<div class="card">
			<div class="flex items-center justify-between mb-unit-2">
				<h3 class="text-base font-semibold text-text-primary">Recent Medications</h3>
				{#if recentMeds.length > 0}
					<button onclick={() => (activeTab = 'meds')} class="text-sm text-primary hover:underline">
						See all
					</button>
				{/if}
			</div>

			{#if recentMeds.length === 0}
				<p class="text-text-secondary text-sm">No medications added yet</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each recentMeds as med (med.id)}
						<li class="flex items-center gap-2 text-sm">
							<span class="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden="true"></span>
							<span class="text-text-primary font-medium">{med.name}</span>
							{#if med.dosage}
								<span class="text-text-secondary">{med.dosage}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if activeTab === 'meds' && profile}
		<!-- Meds Tab -->
		<div>
			<div class="flex items-center justify-between mb-unit-2">
				<h3 class="text-h3 font-semibold text-text-primary">Medications</h3>
				<button
					onclick={openCreateMed}
					class="bg-primary text-white rounded-card px-unit-2 py-1.5 text-sm font-semibold
					       hover:bg-blue-600 transition-colors"
				>
					+ Add Medication
				</button>
			</div>

			{#if medError}
				<div class="card mb-unit-2">
					<p class="text-danger text-sm">{medError}</p>
				</div>
			{/if}

			{#if loadingMeds}
				<p class="text-text-secondary text-sm">Loading medications…</p>
			{:else if medications.length === 0 && !showDiscontinued}
				<!-- Empty state -->
				<div class="card text-center py-unit-4">
					<p class="text-text-secondary mb-unit-2">No medications added yet</p>
					<button
						onclick={openCreateMed}
						class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base
						       hover:bg-blue-600 transition-colors"
					>
						+ Add Medication
					</button>
				</div>
			{:else}
				<!-- Active medications -->
				{#if activeMeds.length > 0}
					<ul class="flex flex-col gap-unit-1 mb-unit-2">
						{#each activeMeds as med (med.id)}
							<li>
								<button
									onclick={() => openEditMed(med)}
									class="card w-full text-left hover:shadow-md transition-shadow active:opacity-90"
								>
									<div class="flex items-baseline gap-2">
										<span class="font-semibold text-text-primary">{med.name}</span>
										{#if med.dosage}
											<span class="text-sm text-text-secondary">{med.dosage}</span>
										{/if}
									</div>
									{#if med.schedule.length > 0}
										<div class="flex flex-wrap gap-1 mt-1">
											{#each med.schedule as slot}
												<span
													class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100 capitalize"
												>
													{SCHEDULE_LABELS[slot] ?? slot}
												</span>
											{/each}
										</div>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<!-- Discontinued medications (shown when toggle is on) -->
				{#if showDiscontinued && discontinuedMeds.length > 0}
					<ul class="flex flex-col gap-unit-1 mb-unit-2">
						{#each discontinuedMeds as med (med.id)}
							<li>
								<button
									onclick={() => openEditMed(med)}
									class="card w-full text-left opacity-50 hover:opacity-70 transition-opacity"
								>
									<div class="flex items-baseline gap-2">
										<span class="font-semibold text-text-secondary line-through">{med.name}</span>
										{#if med.dosage}
											<span class="text-sm text-text-secondary">{med.dosage}</span>
										{/if}
									</div>
									{#if med.schedule.length > 0}
										<div class="flex flex-wrap gap-1 mt-1">
											{#each med.schedule as slot}
												<span
													class="text-xs bg-gray-100 text-text-secondary rounded-full px-2 py-0.5 border border-gray-200 capitalize"
												>
													{SCHEDULE_LABELS[slot] ?? slot}
												</span>
											{/each}
										</div>
									{/if}
									<p class="text-xs text-text-secondary mt-1">Discontinued</p>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}

			<!-- Show discontinued toggle -->
			<div class="flex items-center justify-between pt-unit-1 border-t border-gray-100 mt-unit-2">
				<span class="text-sm text-text-secondary">Show discontinued</span>
				<button
					onclick={toggleDiscontinued}
					aria-label="Toggle show discontinued medications"
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors
					       {showDiscontinued ? 'bg-primary' : 'bg-gray-300'}"
					role="switch"
					aria-checked={showDiscontinued}
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform
						       {showDiscontinued ? 'translate-x-6' : 'translate-x-1'}"
					></span>
				</button>
			</div>
		</div>
	{/if}
</div>

{#if showEditModal && groupId && profile}
	<ProfileModal
		{groupId}
		{profile}
		onSave={handleEditSave}
		onClose={() => (showEditModal = false)}
	/>
{/if}

{#if showMedModal}
	<MedicationModal medication={editingMedication} onSave={handleMedSave} onClose={closeMedModal} />
{/if}
