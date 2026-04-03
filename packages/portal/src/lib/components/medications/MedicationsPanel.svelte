<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		listMedications,
		createMedication,
		updateMedication,
		type Medication,
		type CreateMedicationInput
	} from '$lib/api';
	import MedicationModal from '$lib/components/medications/MedicationModal.svelte';
	import { getErrorMessage } from '$lib/utils/error-utils';

	interface Props {
		profileId: string;
	}

	let { profileId }: Props = $props();

	let medications = $state<Medication[]>([]);
	let loadingMeds = $state(false);
	let showDiscontinued = $state(false);
	let medError = $state('');
	let showMedModal = $state(false);
	let editingMedication = $state<Medication | null>(null);

	const SCHEDULE_LABELS: Record<string, string> = {
		morning: 'Morning',
		afternoon: 'Afternoon',
		evening: 'Evening',
		bedtime: 'Bedtime'
	};

	const activeMeds = $derived(medications.filter((m) => m.status === 'active'));
	const discontinuedMeds = $derived(medications.filter((m) => m.status === 'discontinued'));

	async function loadMedications() {
		loadingMeds = true;
		medError = '';
		try {
			medications = await listMedications(profileId, showDiscontinued);
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			medError = getErrorMessage(err, 'load medications');
		} finally {
			loadingMeds = false;
		}
	}

	onMount(() => {
		loadMedications();
	});

	async function toggleDiscontinued() {
		showDiscontinued = !showDiscontinued;
		await loadMedications();
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
		if (editingMedication) {
			const updated = await updateMedication(profileId, editingMedication.id, data);
			medications = medications.map((m) => (m.id === updated.id ? updated : m));
			if (!showDiscontinued && updated.status === 'discontinued') {
				medications = medications.filter((m) => m.id !== updated.id);
			}
		} else {
			const created = await createMedication(profileId, data);
			medications = [...medications, created];
		}
		closeMedModal();
	}
</script>

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
		<p class="text-text-secondary text-sm">Loading medications...</p>
	{:else if medications.length === 0 && !showDiscontinued}
		<!-- Empty state -->
		<div class="card text-center py-unit-4">
			<p class="text-text-secondary mb-unit-2">
				Track daily medications, dosages, and schedules. Add the first medication to get
				started.
			</p>
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

{#if showMedModal}
	<MedicationModal medication={editingMedication} onSave={handleMedSave} onClose={closeMedModal} />
{/if}
