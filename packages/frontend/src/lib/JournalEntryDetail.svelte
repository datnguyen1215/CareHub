<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getJournalEntry,
		getEvent,
		deleteJournalEntry,
		type JournalEntry,
		type Event
	} from './api';
	import { createFocusTrap } from './focusTrap';

	interface Props {
		groupId: string;
		profileId: string;
		entryId: string;
		onClose: () => void;
		onEdit: (entry: JournalEntry) => void;
		onDeleted: () => void;
		onEventClick: (eventId: string) => void;
	}

	let { groupId, profileId, entryId, onClose, onEdit, onDeleted, onEventClick }: Props = $props();

	let entry = $state<JournalEntry | null>(null);
	let linkedEvent = $state<Event | null>(null);
	let loading = $state(true);
	let error = $state('');
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);
	let modalElement: HTMLElement;

	onMount(() => {
		const cleanup = createFocusTrap(modalElement, onClose);
		loadEntry();
		return cleanup;
	});

	async function loadEntry() {
		loading = true;
		error = '';
		try {
			entry = await getJournalEntry(groupId, profileId, entryId);

			// Load linked event if exists
			if (entry.linked_event_id) {
				try {
					linkedEvent = await getEvent(groupId, profileId, entry.linked_event_id);
				} catch {
					// Event may have been deleted
					linkedEvent = null;
				}
			}
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Failed to load journal entry';
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!entry) return;
		deleting = true;
		try {
			await deleteJournalEntry(groupId, profileId, entry.id);
			onDeleted();
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Failed to delete entry';
		} finally {
			deleting = false;
			showDeleteConfirm = false;
		}
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	function parseKeyTakeaways(text: string | null): string[] {
		if (!text) return [];
		return text
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={modalElement}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
	role="dialog"
	aria-modal="true"
	aria-labelledby="journal-detail-title"
	onmousedown={handleBackdropClick}
>
	<div class="card w-full max-w-md max-h-[90vh] overflow-y-auto">
		{#if loading}
			<p class="text-text-secondary text-sm">Loading...</p>
		{:else if error && !entry}
			<div>
				<p class="text-danger text-sm mb-unit-2">{error}</p>
				<button
					onclick={onClose}
					class="bg-primary text-white rounded-card px-unit-3 py-1.5 text-sm font-semibold"
				>
					Close
				</button>
			</div>
		{:else if entry}
			<!-- Header -->
			<div class="flex items-start justify-between gap-2 mb-unit-2">
				<div class="flex items-center gap-2">
					<button
						onclick={onClose}
						class="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
						aria-label="Back"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="w-5 h-5 text-text-primary"
						>
							<path
								fill-rule="evenodd"
								d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
					<h2 id="journal-detail-title" class="text-h3 font-semibold text-text-primary truncate">
						{entry.title}
					</h2>
				</div>

				<!-- More options -->
				<div class="flex items-center gap-1">
					<button
						onclick={() => onEdit(entry!)}
						class="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
						aria-label="Edit entry"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="w-5 h-5 text-text-secondary"
						>
							<path
								d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
							/>
						</svg>
					</button>
					<button
						onclick={() => (showDeleteConfirm = true)}
						class="p-1.5 rounded-full hover:bg-red-50 transition-colors"
						aria-label="Delete entry"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="w-5 h-5 text-danger"
						>
							<path
								fill-rule="evenodd"
								d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Date and starred indicator -->
			<div class="flex items-center gap-2 mb-unit-2 text-sm text-text-secondary">
				<span>{formatDate(entry.entry_date)}</span>
				{#if entry.starred}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="w-4 h-4 text-yellow-500"
					>
						<path
							fill-rule="evenodd"
							d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</div>

			<!-- Linked event -->
			{#if linkedEvent}
				<button
					onclick={() => onEventClick(linkedEvent!.id)}
					class="w-full flex items-center gap-2 p-2 mb-unit-3 bg-blue-50 rounded-card
					       hover:bg-blue-100 transition-colors text-left"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="w-5 h-5 text-primary shrink-0"
					>
						<path
							fill-rule="evenodd"
							d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
							clip-rule="evenodd"
						/>
					</svg>
					<span class="flex-1 text-sm text-primary font-medium truncate">{linkedEvent.title}</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="w-4 h-4 text-primary shrink-0"
					>
						<path
							fill-rule="evenodd"
							d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			{/if}

			<!-- Key Takeaways -->
			{#if entry.key_takeaways}
				<div class="mb-unit-3">
					<h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
						Key Takeaways
					</h3>
					<div class="bg-gray-50 rounded-card p-3">
						<ul class="flex flex-col gap-1 text-sm text-text-primary">
							{#each parseKeyTakeaways(entry.key_takeaways) as takeaway}
								<li class="flex items-start gap-2">
									<span class="text-text-secondary shrink-0">•</span>
									<span>{takeaway}</span>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			{/if}

			<!-- Notes -->
			<div>
				<h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
					Notes
				</h3>
				<div class="text-sm text-text-primary whitespace-pre-wrap">{entry.content}</div>
			</div>

			{#if error}
				<p class="text-sm text-danger mt-unit-2" role="alert">{error}</p>
			{/if}
		{/if}
	</div>

	<!-- Delete confirmation -->
	{#if showDeleteConfirm}
		<div
			class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-unit-2"
			onmousedown={(e) => {
				if (e.target === e.currentTarget) showDeleteConfirm = false;
			}}
		>
			<div class="card w-full max-w-sm">
				<h3 class="text-h3 font-semibold text-text-primary mb-unit-2">Delete Entry?</h3>
				<p class="text-sm text-text-secondary mb-unit-3">
					Are you sure you want to delete "{entry?.title}"? This cannot be undone.
				</p>
				<div class="flex gap-unit-2 justify-end">
					<button
						onclick={() => (showDeleteConfirm = false)}
						disabled={deleting}
						class="px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary
						       hover:bg-gray-50 disabled:opacity-50 transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleDelete}
						disabled={deleting}
						class="px-unit-3 py-2 rounded-card bg-danger text-white font-semibold text-base
						       hover:bg-red-600 disabled:opacity-50 transition-colors"
					>
						{deleting ? 'Deleting...' : 'Delete'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
