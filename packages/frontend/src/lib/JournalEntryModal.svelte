<script lang="ts">
	import { onMount } from 'svelte';
	import type { JournalEntry, CreateJournalEntryInput, Event } from './api';
	import { listEvents } from './api';
	import { createFocusTrap } from './focusTrap';

	interface Props {
		groupId: string;
		profileId: string;
		entry?: JournalEntry | null;
		onSave: (data: CreateJournalEntryInput) => Promise<void>;
		onClose: () => void;
	}

	let { groupId, profileId, entry = null, onSave, onClose }: Props = $props();

	let title = $state(entry?.title ?? '');
	let content = $state(entry?.content ?? '');
	let keyTakeaways = $state(entry?.key_takeaways ?? '');
	let entryDate = $state(entry?.entry_date ?? new Date().toISOString().split('T')[0]);
	let linkedEventId = $state<string | null>(entry?.linked_event_id ?? null);
	let starred = $state(entry?.starred ?? false);
	let error = $state('');
	let loading = $state(false);
	let modalElement: HTMLElement;

	let availableEvents = $state<Event[]>([]);
	let loadingEvents = $state(true);

	const isEdit = $derived(!!entry);

	onMount(() => {
		const cleanup = createFocusTrap(modalElement, onClose);

		// Load available events for linking
		loadEvents();

		return cleanup;
	});

	async function loadEvents() {
		loadingEvents = true;
		try {
			availableEvents = await listEvents(groupId, profileId);
		} catch {
			// Silently fail - linking is optional
			availableEvents = [];
		} finally {
			loadingEvents = false;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (!title.trim()) {
			error = 'Title is required.';
			return;
		}

		if (!content.trim()) {
			error = 'Notes content is required.';
			return;
		}

		if (!entryDate) {
			error = 'Date is required.';
			return;
		}

		loading = true;
		try {
			const data: CreateJournalEntryInput = {
				title: title.trim(),
				content: content.trim(),
				entry_date: entryDate,
				key_takeaways: keyTakeaways.trim() || null,
				linked_event_id: linkedEventId || null,
				starred
			};

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

	function formatEventOption(event: Event): string {
		const d = new Date(event.event_date);
		const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return `${dateStr} - ${event.title}`;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={modalElement}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
	role="dialog"
	aria-modal="true"
	aria-labelledby="journal-modal-title"
	onmousedown={handleBackdropClick}
>
	<div class="card w-full max-w-md max-h-[90vh] overflow-y-auto">
		<div class="flex items-center justify-between mb-unit-3">
			<h2 id="journal-modal-title" class="text-h3 font-semibold text-text-primary">
				{isEdit ? 'Edit Entry' : 'Add Entry'}
			</h2>
			<button
				onclick={onClose}
				class="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
				aria-label="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="w-5 h-5 text-text-secondary"
				>
					<path
						d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
					/>
				</svg>
			</button>
		</div>

		<form onsubmit={handleSubmit} class="flex flex-col gap-unit-2" novalidate>
			<!-- Title -->
			<div>
				<label for="journal-title" class="block text-sm font-medium text-text-primary mb-1">
					Title <span class="text-danger">*</span>
				</label>
				<input
					id="journal-title"
					type="text"
					bind:value={title}
					disabled={loading}
					required
					placeholder="e.g. Post-Visit Notes"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Date -->
			<div>
				<label for="journal-date" class="block text-sm font-medium text-text-primary mb-1">
					Date <span class="text-danger">*</span>
				</label>
				<input
					id="journal-date"
					type="date"
					bind:value={entryDate}
					disabled={loading}
					required
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Link to Event -->
			<div>
				<label for="journal-event" class="block text-sm font-medium text-text-primary mb-1">
					Link to Event <span class="text-text-secondary text-xs">(optional)</span>
				</label>
				<select
					id="journal-event"
					bind:value={linkedEventId}
					disabled={loading || loadingEvents}
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				>
					<option value={null}>None</option>
					{#each availableEvents as event (event.id)}
						<option value={event.id}>{formatEventOption(event)}</option>
					{/each}
				</select>
			</div>

			<!-- Key Takeaways -->
			<div>
				<label for="journal-takeaways" class="block text-sm font-medium text-text-primary mb-1">
					Key Takeaways <span class="text-text-secondary text-xs">(optional)</span>
				</label>
				<textarea
					id="journal-takeaways"
					bind:value={keyTakeaways}
					disabled={loading}
					placeholder="Bullet points for quick reference..."
					rows={3}
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50 resize-none"
				></textarea>
			</div>

			<!-- Notes -->
			<div>
				<label for="journal-content" class="block text-sm font-medium text-text-primary mb-1">
					Notes <span class="text-danger">*</span>
				</label>
				<textarea
					id="journal-content"
					bind:value={content}
					disabled={loading}
					required
					placeholder="Write your notes here..."
					rows={5}
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50 resize-none"
				></textarea>
			</div>

			<!-- Star toggle -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => (starred = !starred)}
					disabled={loading}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors
					       {starred
						? 'bg-yellow-50 text-yellow-700 border-yellow-300'
						: 'bg-surface text-text-secondary border-gray-300 hover:border-yellow-300'}
					       disabled:opacity-50"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill={starred ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width={starred ? '0' : '1.5'}
						class="w-4 h-4"
					>
						<path
							fill-rule="evenodd"
							d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
							clip-rule="evenodd"
						/>
					</svg>
					{starred ? 'Starred' : 'Star this entry'}
				</button>
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
					disabled={loading || !title.trim() || !content.trim()}
					class="px-unit-3 py-2 rounded-card bg-primary text-white font-semibold text-base
					       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? 'Saving...' : 'Save'}
				</button>
			</div>
		</form>
	</div>
</div>
