<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listJournalEntries, updateJournalEntry, type JournalEntry } from '$lib/api';
	import { debounce } from '$lib/utils/debounce';
	import { formatDateShort } from '$lib/utils/format';

	interface Props {
		profileId: string;
		onEntryClick: (entry: JournalEntry) => void;
		onAddClick: () => void;
	}

	let { profileId, onEntryClick, onAddClick }: Props = $props();

	let entries = $state<JournalEntry[]>([]);
	let loading = $state(true);
	let error = $state('');
	let searchQuery = $state('');
	let sortOrder = $state<'recent' | 'oldest'>('recent');
	const debouncedSearch = debounce(() => loadEntries(), 300);

	async function loadEntries() {
		loading = true;
		error = '';
		try {
			entries = await listJournalEntries(profileId, searchQuery.trim() || undefined, sortOrder);
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Failed to load journal entries';
		} finally {
			loading = false;
		}
	}


	// Initial load only — don't use $effect here as it would auto-track searchQuery
	// and sortOrder, causing duplicate API calls alongside the debounced search and
	// explicit sort handlers
	onMount(() => {
		loadEntries();
	});

	onDestroy(() => {
		debouncedSearch.cancel();
	});

	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		debouncedSearch();
	}

	function handleSortChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		sortOrder = target.value as 'recent' | 'oldest';
		loadEntries();
	}

	async function toggleStar(entry: JournalEntry, e: MouseEvent) {
		e.stopPropagation();
		try {
			const updated = await updateJournalEntry(profileId, entry.id, {
				starred: !entry.starred
			});
			entries = entries.map((en) => (en.id === updated.id ? updated : en));
		} catch {
			// Silently fail for star toggle
		}
	}


	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength).trim() + '...';
	}
</script>

<div class="flex flex-col gap-unit-2">
	<!-- Search bar -->
	<div class="relative">
		<span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden="true">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="w-5 h-5"
			>
				<path
					fill-rule="evenodd"
					d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
					clip-rule="evenodd"
				/>
			</svg>
		</span>
		<input
			type="text"
			placeholder="Search entries..."
			value={searchQuery}
			oninput={handleSearchInput}
			class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
			       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
		/>
	</div>

	<!-- Sort and Add button row -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<label for="journal-sort" class="text-sm text-text-secondary">Sort:</label>
			<select
				id="journal-sort"
				value={sortOrder}
				onchange={handleSortChange}
				class="px-2 py-1 border border-gray-300 rounded text-sm bg-surface text-text-primary
				       focus:outline-none focus:ring-2 focus:ring-primary"
			>
				<option value="recent">Recent</option>
				<option value="oldest">Oldest</option>
			</select>
		</div>
		<button
			onclick={onAddClick}
			class="bg-primary text-white rounded-card px-unit-2 py-1.5 text-sm font-semibold
			       hover:bg-blue-600 transition-colors"
		>
			+ Add
		</button>
	</div>

	<!-- Entries list -->
	{#if loading}
		<p class="text-text-secondary text-sm">Loading...</p>
	{:else if error}
		<div class="card">
			<p class="text-danger text-sm">{error}</p>
		</div>
	{:else if entries.length === 0}
		<div class="card text-center py-unit-4">
			{#if searchQuery.trim()}
				<p class="text-text-secondary mb-unit-2">No entries match your search</p>
			{:else}
				<p class="text-text-secondary mb-unit-2">Record doctor visit notes, symptoms, or observations. Entries can link to calendar events.</p>
				<button
					onclick={onAddClick}
					class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base
					       hover:bg-blue-600 transition-colors"
				>
					+ Add Entry
				</button>
			{/if}
		</div>
	{:else}
		<ul class="flex flex-col gap-unit-1">
			{#each entries as entry (entry.id)}
				<li class="card hover:shadow-md transition-shadow">
					<div class="flex items-start justify-between gap-2">
						<button
							onclick={() => onEntryClick(entry)}
							class="flex-1 min-w-0 text-left active:opacity-90"
						>
							<div class="flex items-center gap-2 mb-1">
								<span class="text-sm text-text-secondary">{formatDateShort(entry.entry_date)}</span>
								{#if entry.attachment_count && entry.attachment_count > 0}
									<span
										class="inline-flex items-center gap-0.5 text-xs text-text-secondary"
										title="{entry.attachment_count} attachment{entry.attachment_count > 1 ? 's' : ''}"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="w-3.5 h-3.5"
										>
											<path
												fill-rule="evenodd"
												d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
												clip-rule="evenodd"
											/>
										</svg>
										{entry.attachment_count}
									</span>
								{/if}
							</div>
							<h3 class="font-semibold text-text-primary truncate">{entry.title}</h3>
							<p class="text-sm text-text-secondary mt-0.5">
								{truncateText(entry.content, 80)}
							</p>
						</button>
						<button
							onclick={(e) => toggleStar(entry, e)}
							class="p-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0"
							aria-label={entry.starred ? 'Unstar entry' : 'Star entry'}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill={entry.starred ? 'currentColor' : 'none'}
								stroke="currentColor"
								stroke-width={entry.starred ? '0' : '1.5'}
								class="w-5 h-5 {entry.starred ? 'text-yellow-500' : 'text-gray-400'}"
							>
								<path
									fill-rule="evenodd"
									d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
