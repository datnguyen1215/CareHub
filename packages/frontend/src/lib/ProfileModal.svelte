<script lang="ts">
	import type { CareProfile, CreateProfileInput } from './api';

	interface Props {
		groupId: string;
		profile?: CareProfile | null;
		onSave: (data: CreateProfileInput) => Promise<void>;
		onClose: () => void;
	}

	let { groupId: _groupId, profile = null, onSave, onClose }: Props = $props();

	let name = $state(profile?.name ?? '');
	let dateOfBirth = $state(profile?.date_of_birth ?? '');
	let relationship = $state(profile?.relationship ?? '');
	let conditionsRaw = $state((profile?.conditions ?? []).join(', '));
	let error = $state('');
	let loading = $state(false);

	const isEdit = $derived(!!profile);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (!name.trim()) {
			error = 'Name is required.';
			return;
		}

		loading = true;
		try {
			const conditions = conditionsRaw
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);

			await onSave({
				name: name.trim(),
				date_of_birth: dateOfBirth.trim() || null,
				relationship: relationship.trim() || null,
				conditions
			});
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
	aria-labelledby="modal-title"
	onmousedown={handleBackdropClick}
>
	<div class="card w-full max-w-md">
		<h2 id="modal-title" class="text-h3 font-semibold text-text-primary mb-unit-3">
			{isEdit ? 'Edit Profile' : 'Add Profile'}
		</h2>

		<form onsubmit={handleSubmit} class="flex flex-col gap-unit-2" novalidate>
			<!-- Name -->
			<div>
				<label for="profile-name" class="block text-sm font-medium text-text-primary mb-1">
					Name <span class="text-danger">*</span>
				</label>
				<input
					id="profile-name"
					type="text"
					bind:value={name}
					disabled={loading}
					required
					placeholder="e.g. Grandma Rose"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Date of Birth -->
			<div>
				<label for="profile-dob" class="block text-sm font-medium text-text-primary mb-1">
					Date of birth <span class="text-text-secondary text-xs">(optional)</span>
				</label>
				<input
					id="profile-dob"
					type="date"
					bind:value={dateOfBirth}
					disabled={loading}
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Relationship -->
			<div>
				<label for="profile-relationship" class="block text-sm font-medium text-text-primary mb-1">
					Relationship <span class="text-text-secondary text-xs">(optional)</span>
				</label>
				<input
					id="profile-relationship"
					type="text"
					bind:value={relationship}
					disabled={loading}
					placeholder="e.g. grandmother, father"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Conditions -->
			<div>
				<label for="profile-conditions" class="block text-sm font-medium text-text-primary mb-1">
					Conditions <span class="text-text-secondary text-xs">(optional, comma-separated)</span>
				</label>
				<input
					id="profile-conditions"
					type="text"
					bind:value={conditionsRaw}
					disabled={loading}
					placeholder="e.g. diabetes, hypertension"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

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
