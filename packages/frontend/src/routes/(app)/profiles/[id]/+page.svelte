<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		listGroups,
		listProfiles,
		listMedications,
		createMedication,
		updateMedication,
		deleteMedication,
		type CareProfile,
		type Medication,
		type CreateMedicationInput
	} from '$lib/api';
	import MedicationModal from '$lib/MedicationModal.svelte';

	const profileId = $derived($page.params.id ?? '');

	let groupId = $state<string | null>(null);
	let profile = $state<CareProfile | null>(null);
	let medications = $state<Medication[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let showDiscontinued = $state(false);
	let loadingMeds = $state(false);

	let showModal = $state(false);
	let editingMedication = $state<Medication | null>(null);

	onMount(async () => {
		try {
			const groups = await listGroups();
			if (groups.length === 0) {
				loadError = 'No group found.';
				return;
			}
			groupId = groups[0].id;

			const profiles = await listProfiles(groupId);
			const found = profiles.find((p) => p.id === profileId);
			if (!found) {
				loadError = 'Profile not found.';
				return;
			}
			profile = found;

			medications = await listMedications(groupId, profileId, false);
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			loadError = 'Failed to load profile.';
		} finally {
			loading = false;
		}
	});

	async function toggleDiscontinued() {
		if (!groupId) return;
		showDiscontinued = !showDiscontinued;
		loadingMeds = true;
		try {
			medications = await listMedications(groupId, profileId, showDiscontinued);
		} catch {
			// keep current list on error
		} finally {
			loadingMeds = false;
		}
	}

	function openCreate() {
		editingMedication = null;
		showModal = true;
	}

	function openEdit(med: Medication) {
		editingMedication = med;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingMedication = null;
	}

	async function handleSave(data: CreateMedicationInput) {
		if (!groupId) return;

		if (editingMedication) {
			const updated = await updateMedication(groupId, profileId, editingMedication.id, data);
			medications = medications.map((m) => (m.id === updated.id ? updated : m));
			// If not showing discontinued and it was just discontinued, remove it
			if (!showDiscontinued && updated.status === 'discontinued') {
				medications = medications.filter((m) => m.id !== updated.id);
			}
		} else {
			const created = await createMedication(groupId, profileId, data);
			medications = [...medications, created];
		}

		closeModal();
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

<div class="max-w-2xl mx-auto px-unit-3 py-unit-3">
	<!-- Back button + profile name -->
	<div class="flex items-center gap-unit-2 mb-unit-3">
		<button
			onclick={() => goto('/')}
			class="text-primary text-sm font-medium hover:underline flex items-center gap-1"
			aria-label="Back to profiles"
		>
			← Back
		</button>
	</div>

	{#if loading}
		<p class="text-text-secondary text-sm">Loading…</p>
	{:else if loadError}
		<div class="card">
			<p class="text-danger text-sm">{loadError}</p>
		</div>
	{:else if profile}
		<!-- Profile header -->
		<div class="mb-unit-3">
			<h2 class="text-h2 font-semibold text-text-primary">{profile.name}</h2>
			{#if profile.relationship}
				<p class="text-sm text-text-secondary capitalize">{profile.relationship}</p>
			{/if}
		</div>

		<!-- Medications section -->
		<div>
			<div class="flex items-center justify-between mb-unit-2">
				<h3 class="text-h3 font-semibold text-text-primary">Medications</h3>
				<button
					onclick={openCreate}
					class="bg-primary text-white rounded-card px-unit-2 py-1.5 text-sm font-semibold
					       hover:bg-blue-600 transition-colors"
				>
					+ Add Medication
				</button>
			</div>

			{#if loadingMeds}
				<p class="text-text-secondary text-sm">Loading medications…</p>
			{:else if medications.length === 0 && !showDiscontinued}
				<!-- Empty state -->
				<div class="card text-center py-unit-4">
					<p class="text-text-secondary mb-unit-2">No medications added yet</p>
					<button
						onclick={openCreate}
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
									onclick={() => openEdit(med)}
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
									onclick={() => openEdit(med)}
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

{#if showModal}
	<MedicationModal medication={editingMedication} onSave={handleSave} onClose={closeModal} />
{/if}
