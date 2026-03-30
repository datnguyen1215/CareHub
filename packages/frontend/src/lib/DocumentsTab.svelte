<script lang="ts">
	import { onMount } from 'svelte'
	import {
		listAttachments,
		getJournalEntry,
		getEvent,
		type Attachment,
		type AttachmentCategory
	} from './api'

	interface Props {
		profileId: string
		onNavigateToJournal: (journalId: string) => void
		onNavigateToEvent: (eventId: string) => void
	}

	let { profileId, onNavigateToJournal, onNavigateToEvent }: Props = $props()

	let attachments = $state<Attachment[]>([])
	let loading = $state(true)
	let error = $state('')
	let searchQuery = $state('')
	let activeCategory = $state<AttachmentCategory | 'all'>('all')
	let searchTimeout: ReturnType<typeof setTimeout> | null = null
	let hasMore = $state(false)
	let loadingMore = $state(false)

	// Cache for parent context (journal/event titles)
	let parentContextCache = $state<Record<string, string>>({})

	const INITIAL_LIMIT = 10
	const LOAD_MORE_LIMIT = 10

	const categories: { value: AttachmentCategory | 'all'; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'lab_result', label: 'Lab Results' },
		{ value: 'prescription', label: 'Prescriptions' },
		{ value: 'insurance', label: 'Insurance' },
		{ value: 'billing', label: 'Billing' },
		{ value: 'imaging', label: 'Imaging' }
	]

	const categoryLabels: Record<string, string> = {
		lab_result: 'Lab Result',
		prescription: 'Prescription',
		insurance: 'Insurance',
		billing: 'Billing',
		imaging: 'Imaging',
		other: 'Other'
	}

	const categoryColors: Record<string, string> = {
		lab_result: 'bg-green-50 text-green-700 border-green-200',
		prescription: 'bg-blue-50 text-blue-700 border-blue-200',
		insurance: 'bg-purple-50 text-purple-700 border-purple-200',
		billing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
		imaging: 'bg-pink-50 text-pink-700 border-pink-200',
		other: 'bg-gray-50 text-gray-700 border-gray-200'
	}

	async function loadAttachments(append = false) {
		if (!append) {
			loading = true
		} else {
			loadingMore = true
		}
		error = ''

		try {
			const currentCount = append ? attachments.length : 0
			const limit = append ? LOAD_MORE_LIMIT : INITIAL_LIMIT

			const results = await listAttachments(profileId, {
				category: activeCategory === 'all' ? undefined : activeCategory,
				search: searchQuery.trim() || undefined,
				limit: limit + 1 // Fetch one extra to check if there's more
			})

			// Check if there's more data
			if (results.length > limit) {
				hasMore = true
				results.pop() // Remove the extra item
			} else {
				hasMore = false
			}

			if (append) {
				// Filter out duplicates when appending
				const existingIds = new Set(attachments.map((a) => a.id))
				const newItems = results.filter((a) => !existingIds.has(a.id))
				attachments = [...attachments, ...newItems]
			} else {
				attachments = results
			}

			// Fetch parent context for new attachments
			await loadParentContexts(results)
		} catch (err: unknown) {
			const apiErr = err as { message?: string }
			error = apiErr?.message ?? 'Failed to load documents'
		} finally {
			loading = false
			loadingMore = false
		}
	}

	async function loadParentContexts(items: Attachment[]) {
		const promises: Promise<void>[] = []

		for (const attachment of items) {
			const cacheKey = attachment.journal_id
				? `journal:${attachment.journal_id}`
				: attachment.event_id
					? `event:${attachment.event_id}`
					: null

			if (cacheKey && !parentContextCache[cacheKey]) {
				if (attachment.journal_id) {
					promises.push(
						getJournalEntry(profileId, attachment.journal_id)
							.then((journal) => {
								parentContextCache[`journal:${journal.id}`] = journal.title
							})
							.catch(() => {
								// Silently fail for context loading
							})
					)
				} else if (attachment.event_id) {
					promises.push(
						getEvent(profileId, attachment.event_id)
							.then((event) => {
								parentContextCache[`event:${event.id}`] = event.title
							})
							.catch(() => {
								// Silently fail for context loading
							})
					)
				}
			}
		}

		await Promise.all(promises)
		// Trigger reactivity
		parentContextCache = { ...parentContextCache }
	}

	function getParentContext(attachment: Attachment): { label: string; id: string; type: 'journal' | 'event' } | null {
		if (attachment.journal_id) {
			const title = parentContextCache[`journal:${attachment.journal_id}`]
			return { label: title ?? 'Journal Entry', id: attachment.journal_id, type: 'journal' }
		}
		if (attachment.event_id) {
			const title = parentContextCache[`event:${attachment.event_id}`]
			return { label: title ?? 'Event', id: attachment.event_id, type: 'event' }
		}
		return null
	}

	onMount(() => {
		loadAttachments()
	})

	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement
		searchQuery = target.value

		// Debounce search
		if (searchTimeout) clearTimeout(searchTimeout)
		searchTimeout = setTimeout(() => {
			loadAttachments()
		}, 300)
	}

	function handleCategoryChange(category: AttachmentCategory | 'all') {
		activeCategory = category
		loadAttachments()
	}

	function handleLoadMore() {
		loadAttachments(true)
	}

	function handleAttachmentClick(attachment: Attachment) {
		const parent = getParentContext(attachment)
		if (parent) {
			if (parent.type === 'journal') {
				onNavigateToJournal(parent.id)
			} else {
				onNavigateToEvent(parent.id)
			}
		}
	}

	function isImage(url: string): boolean {
		const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
		const lowerUrl = url.toLowerCase()
		return imageExtensions.some((ext) => lowerUrl.includes(ext))
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr)
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
			placeholder="Search documents..."
			value={searchQuery}
			oninput={handleSearchInput}
			class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
			       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
		/>
	</div>

	<!-- Category filter chips -->
	<div class="flex flex-wrap gap-2">
		{#each categories as cat}
			<button
				onclick={() => handleCategoryChange(cat.value)}
				class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors
				       {activeCategory === cat.value
					? 'bg-primary text-white'
					: 'bg-surface border border-gray-300 text-text-secondary hover:border-gray-400'}"
			>
				{cat.label}
			</button>
		{/each}
	</div>

	<!-- Documents list -->
	{#if loading}
		<p class="text-text-secondary text-sm">Loading...</p>
	{:else if error}
		<div class="card">
			<p class="text-danger text-sm">{error}</p>
		</div>
	{:else if attachments.length === 0}
		<div class="card text-center py-unit-4">
			{#if searchQuery.trim() || activeCategory !== 'all'}
				<p class="text-text-secondary mb-unit-1">No documents match your filters</p>
				<p class="text-sm text-text-secondary">Try adjusting your search or category filter</p>
			{:else}
				<p class="text-text-secondary mb-unit-1">No documents yet</p>
				<p class="text-sm text-text-secondary">Add documents to your journal entries or calendar events</p>
			{/if}
		</div>
	{:else}
		<ul class="flex flex-col gap-unit-2">
			{#each attachments as attachment (attachment.id)}
				{@const parent = getParentContext(attachment)}
				<li>
					<button
						onclick={() => handleAttachmentClick(attachment)}
						class="card w-full text-left hover:shadow-md transition-shadow active:opacity-90 flex gap-3"
					>
						<!-- Thumbnail -->
						<div class="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
							{#if isImage(attachment.file_url)}
								<img
									src={attachment.file_url}
									alt=""
									class="w-full h-full object-cover"
								/>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="w-8 h-8 text-red-500"
								>
									<path
										fill-rule="evenodd"
										d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM9.75 14.25a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5H9.75Z"
										clip-rule="evenodd"
									/>
									<path
										d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z"
									/>
								</svg>
							{/if}
						</div>

						<!-- Content -->
						<div class="flex-1 min-w-0">
							<!-- Description -->
							<p class="font-semibold text-text-primary truncate">
								{attachment.description ?? 'Untitled document'}
							</p>

							<!-- Date and category -->
							<div class="flex items-center gap-2 mt-1">
								<span class="text-sm text-text-secondary">{formatDate(attachment.created_at)}</span>
								<span
									class="text-xs px-2 py-0.5 rounded-full border {categoryColors[attachment.category] ??
										categoryColors.other}"
								>
									{categoryLabels[attachment.category] ?? 'Other'}
								</span>
							</div>

							<!-- Parent context -->
							{#if parent}
								<p class="text-sm text-text-secondary mt-1 flex items-center gap-1">
									<span class="text-gray-400">From:</span>
									<span class="truncate">{parent.label}</span>
								</p>
							{/if}
						</div>

						<!-- Arrow icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="w-5 h-5 text-gray-400 shrink-0 self-center"
						>
							<path
								fill-rule="evenodd"
								d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</li>
			{/each}
		</ul>

		<!-- Load more button -->
		{#if hasMore}
			<button
				onclick={handleLoadMore}
				disabled={loadingMore}
				class="w-full py-2 text-primary font-medium hover:underline disabled:opacity-50"
			>
				{loadingMore ? 'Loading...' : 'Load more'}
			</button>
		{/if}
	{/if}
</div>
