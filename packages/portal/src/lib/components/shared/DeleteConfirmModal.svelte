<script lang="ts">
	interface Props {
		name: string;
		onConfirm: () => Promise<void>;
		onClose: () => void;
	}

	let { name, onConfirm, onClose }: Props = $props();

	let loading = $state(false);
	let error = $state('');

	async function handleDelete() {
		error = '';
		loading = true;
		try {
			await onConfirm();
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Failed to delete profile.';
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
	tabindex="-1"
	aria-labelledby="delete-modal-title"
	onmousedown={handleBackdropClick}
>
	<div class="card w-full max-w-sm">
		<h2 id="delete-modal-title" class="text-h3 font-semibold text-text-primary mb-unit-2">
			Remove profile
		</h2>
		<p class="text-base text-text-secondary mb-unit-3">
			Are you sure you want to remove <strong class="text-text-primary">{name}</strong>? This cannot
			be undone.
		</p>

		{#if error}
			<p class="text-sm text-danger mb-unit-2" role="alert">{error}</p>
		{/if}

		<div class="flex gap-unit-2 justify-end">
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
				type="button"
				onclick={handleDelete}
				disabled={loading}
				class="px-unit-3 py-2 rounded-card bg-danger text-white font-semibold text-base
				       hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
			>
				{loading ? 'Deleting…' : 'Delete'}
			</button>
		</div>
	</div>
</div>
