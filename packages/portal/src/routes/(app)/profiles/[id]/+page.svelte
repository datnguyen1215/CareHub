<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getProfile, updateProfile, type CareProfile, type CreateProfileInput } from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/utils/error-utils';
	import OverviewPanel from '$lib/components/profiles/OverviewPanel.svelte';
	import MedicationsPanel from '$lib/components/medications/MedicationsPanel.svelte';
	import CalendarPanel from '$lib/components/events/CalendarPanel.svelte';
	import JournalPanel from '$lib/components/journal/JournalPanel.svelte';
	import DocumentsTab from '$lib/components/documents/DocumentsTab.svelte';
	import ProfileModal from '$lib/components/profiles/ProfileModal.svelte';

	const profileId = $derived(page.params.id ?? '');

	let profile = $state<CareProfile | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let canRetry = $state(false);
	let activeTab = $state<'overview' | 'meds' | 'calendar' | 'journal' | 'documents'>('overview');
	let showEditModal = $state(false);

	// Track initial IDs for cross-tab navigation from DocumentsTab
	let initialJournalEntryId = $state<string | null>(null);
	let initialEventId = $state<string | null>(null);

	async function loadProfile() {
		loading = true;
		loadError = '';
		canRetry = false;

		try {
			profile = await getProfile(profileId);
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

	loadProfile();

	function handleProfileUpdate(updated: CareProfile) {
		profile = updated;
	}

	async function handleEditSave(data: CreateProfileInput) {
		if (!profile) return;
		const updated = await updateProfile(profile.id, data);
		handleProfileUpdate(updated);
		showEditModal = false;
	}

	function handleNavigateToJournal(journalId: string) {
		initialJournalEntryId = journalId;
		activeTab = 'journal';
	}

	function handleNavigateToEvent(eventId: string) {
		initialEventId = eventId;
		activeTab = 'calendar';
	}

	function handleInitialJournalIdConsumed() {
		initialJournalEntryId = null;
	}

	function handleInitialEventIdConsumed() {
		initialEventId = null;
	}
</script>

<!-- Page-specific top bar (overrides the global TopBar for this page) -->
<div class="fixed top-0 left-0 right-0 bg-surface border-b border-gray-200 z-50">
	<div class="max-w-2xl mx-auto flex items-center justify-between px-unit-2 h-14">
		<!-- Back arrow -->
		<button
			onclick={() => goto('/profiles')}
			class="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
			aria-label="Back to profiles"
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

{#if loading}
	<!-- Loading skeleton -->
	<div class="max-w-2xl mx-auto px-unit-2 py-unit-3 animate-pulse space-y-unit-3" aria-label="Loading profile">
		<div class="card">
			<div class="flex items-center gap-unit-3">
				<div class="w-16 h-16 rounded-full bg-gray-200 shrink-0"></div>
				<div class="flex-1 space-y-2">
					<div class="h-5 bg-gray-200 rounded w-1/3"></div>
					<div class="h-3 bg-gray-200 rounded w-1/2"></div>
					<div class="h-3 bg-gray-200 rounded w-2/3"></div>
				</div>
			</div>
		</div>
		<div class="flex gap-unit-1">
			{#each ['Overview', 'Meds', 'Calendar', 'Journal', 'Docs'] as _}
				<div class="h-9 bg-gray-200 rounded-lg w-16"></div>
			{/each}
		</div>
		<div class="grid grid-cols-3 gap-unit-2">
			{#each Array(3) as _}
				<div class="card p-unit-2 space-y-2">
					<div class="h-3 bg-gray-200 rounded w-2/3"></div>
					<div class="h-4 bg-gray-200 rounded w-1/2"></div>
				</div>
			{/each}
		</div>
	</div>
{:else if loadError}
	<!-- Error state -->
	<div class="max-w-2xl mx-auto px-unit-2 py-unit-3">
		<div class="card">
			<p class="text-danger text-sm mb-unit-2">{loadError}</p>
			{#if canRetry}
				<button
					onclick={loadProfile}
					class="bg-primary text-white rounded-card px-unit-3 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
				>
					Retry
				</button>
			{/if}
		</div>
	</div>
{:else}
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
		<button
			onclick={() => (activeTab = 'calendar')}
			class="flex-1 py-3 min-h-[44px] text-sm font-semibold transition-colors
				{activeTab === 'calendar'
				? 'text-primary border-b-2 border-primary'
				: 'text-text-secondary hover:text-text-primary'}"
		>
			Calendar
		</button>
		<button
			onclick={() => (activeTab = 'journal')}
			class="flex-1 py-3 min-h-[44px] text-sm font-semibold transition-colors
				{activeTab === 'journal'
				? 'text-primary border-b-2 border-primary'
				: 'text-text-secondary hover:text-text-primary'}"
		>
			Journal
		</button>
		<button
			onclick={() => (activeTab = 'documents')}
			class="flex-1 py-3 min-h-[44px] text-sm font-semibold transition-colors
				{activeTab === 'documents'
				? 'text-primary border-b-2 border-primary'
				: 'text-text-secondary hover:text-text-primary'}"
		>
			Docs
		</button>
	</div>
</div>

<!-- Page content — all panels mounted, hidden attribute toggles visibility -->
<div class="max-w-2xl mx-auto px-unit-2 py-unit-3">
	<div hidden={activeTab !== 'overview'}>
		<OverviewPanel {profileId} {profile} onProfileUpdate={handleProfileUpdate} />
	</div>
	<div hidden={activeTab !== 'meds'}>
		<MedicationsPanel {profileId} />
	</div>
	<div hidden={activeTab !== 'calendar'}>
		<CalendarPanel {profileId} profileName={profile?.name} {initialEventId} onInitialIdConsumed={handleInitialEventIdConsumed} />
	</div>
	<div hidden={activeTab !== 'journal'}>
		<JournalPanel {profileId} initialEntryId={initialJournalEntryId} onInitialIdConsumed={handleInitialJournalIdConsumed} />
	</div>
	<div hidden={activeTab !== 'documents'}>
		<DocumentsTab
			{profileId}
			onNavigateToJournal={handleNavigateToJournal}
			onNavigateToEvent={handleNavigateToEvent}
		/>
	</div>
</div>

{#if showEditModal && profile}
	<ProfileModal {profile} onSave={handleEditSave} onClose={() => (showEditModal = false)} />
{/if}
{/if}
