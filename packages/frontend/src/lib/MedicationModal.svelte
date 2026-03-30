<script lang="ts">
	import type { Medication, CreateMedicationInput } from './api';

	interface Props {
		medication?: Medication | null;
		onSave: (data: CreateMedicationInput) => Promise<void>;
		onClose: () => void;
	}

	let { medication = null, onSave, onClose }: Props = $props();

	const SCHEDULE_OPTIONS = ['morning', 'afternoon', 'evening', 'bedtime'] as const;
	type ScheduleOption = (typeof SCHEDULE_OPTIONS)[number];

	let name = $state(medication?.name ?? '');
	let dosage = $state(medication?.dosage ?? '');
	let selectedSchedule = $state<Set<ScheduleOption>>(
		new Set((medication?.schedule ?? []) as ScheduleOption[])
	);
	let status = $state<'active' | 'discontinued'>(medication?.status ?? 'active');
	let error = $state('');
	let loading = $state(false);

	const isEdit = $derived(!!medication);

	function toggleSchedule(option: ScheduleOption) {
		const next = new Set(selectedSchedule);
		if (next.has(option)) {
			next.delete(option);
		} else {
			next.add(option);
		}
		selectedSchedule = next;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (!name.trim()) {
			error = 'Name is required.';
			return;
		}

		loading = true;
		try {
			const data: CreateMedicationInput = {
				name: name.trim(),
				dosage: dosage.trim() || null,
				schedule: SCHEDULE_OPTIONS.filter((o) => selectedSchedule.has(o))
			};

			if (isEdit) {
				data.status = status;
			}

			await onSave(data);
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Something went wrong.';
		} finally {
			loading = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
	role="dialog"
	aria-modal="true"
	aria-labelledby="med-modal-title"
	onmousedown={handleBackdropClick}
>
	<div class="card w-full max-w-md">
		<h2 id="med-modal-title" class="text-h3 font-semibold text-text-primary mb-unit-3">
			{isEdit ? 'Edit Medication' : 'Add Medication'}
		</h2>

		<form onsubmit={handleSubmit} class="flex flex-col gap-unit-2" novalidate>
			<!-- Name -->
			<div>
				<label for="med-name" class="block text-sm font-medium text-text-primary mb-1">
					Name <span class="text-danger">*</span>
				</label>
				<input
					id="med-name"
					type="text"
					bind:value={name}
					disabled={loading}
					required
					placeholder="e.g. Metformin"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Dosage -->
			<div>
				<label for="med-dosage" class="block text-sm font-medium text-text-primary mb-1">
					Dosage <span class="text-text-secondary text-xs">(optional)</span>
				</label>
				<input
					id="med-dosage"
					type="text"
					bind:value={dosage}
					disabled={loading}
					placeholder="e.g. 500mg"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Schedule chips -->
			<div>
				<p class="block text-sm font-medium text-text-primary mb-1">
					Schedule <span class="text-text-secondary text-xs">(optional)</span>
				</p>
				<div class="flex flex-wrap gap-2">
					{#each SCHEDULE_OPTIONS as option}
						<button
							type="button"
							onclick={() => toggleSchedule(option)}
							disabled={loading}
							class="px-3 py-2.5 rounded-full text-sm font-medium border transition-colors capitalize min-h-[44px]
							       {selectedSchedule.has(option)
								? 'bg-primary text-white border-primary'
								: 'bg-surface text-text-secondary border-gray-300 hover:border-primary hover:text-primary'}
							       disabled:opacity-50"
						>
							{option}
						</button>
					{/each}
				</div>
			</div>

			<!-- Status toggle — edit mode only -->
			{#if isEdit}
				<div>
					<p class="block text-sm font-medium text-text-primary mb-1">Status</p>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => (status = 'active')}
							disabled={loading}
							class="px-3 py-2.5 rounded-full text-sm font-medium border transition-colors min-h-[44px]
							       {status === 'active'
								? 'bg-success text-white border-success'
								: 'bg-surface text-text-secondary border-gray-300 hover:border-success hover:text-success'}
							       disabled:opacity-50"
						>
							Active
						</button>
						<button
							type="button"
							onclick={() => (status = 'discontinued')}
							disabled={loading}
							class="px-3 py-2.5 rounded-full text-sm font-medium border transition-colors min-h-[44px]
							       {status === 'discontinued'
								? 'bg-text-secondary text-white border-text-secondary'
								: 'bg-surface text-text-secondary border-gray-300 hover:border-text-secondary'}
							       disabled:opacity-50"
						>
							Discontinued
						</button>
					</div>
				</div>
			{/if}

			{#if error}
				<p class="text-sm text-danger" role="alert">{error}</p>
			{/if}

			<div class="flex gap-unit-2 justify-end pt-unit-1">
				<button
					type="button"
					onclick={onClose}
					disabled={loading}
					class="px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary
					       hover:bg-gray-50 disabled:opacity-50 transition-colors"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={loading || !name.trim()}
					class="px-unit-3 py-2 rounded-card bg-primary text-white font-semibold text-base
					       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? 'Saving…' : 'Save'}
				</button>
			</div>
		</form>
	</div>
</div>
