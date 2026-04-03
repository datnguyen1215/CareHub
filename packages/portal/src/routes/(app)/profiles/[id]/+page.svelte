<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getProfile, updateProfile, type CareProfile, type CreateProfileInput } from '$lib/api';
	import OverviewPanel from '$lib/components/profiles/OverviewPanel.svelte';
	import MedicationsPanel from '$lib/components/medications/MedicationsPanel.svelte';
	import CalendarPanel from '$lib/components/events/CalendarPanel.svelte';
	import JournalPanel from '$lib/components/journal/JournalPanel.svelte';
	import DocumentsTab from '$lib/components/documents/DocumentsTab.svelte';
	import ProfileModal from '$lib/components/profiles/ProfileModal.svelte';

	const profileId = $derived($page.params.id ?? '');

	let profile = $state<CareProfile | null>(null);
	let activeTab = $state<'overview' | 'meds' | 'calendar' | 'journal' | 'documents'>('overview');
	let showEditModal = $state(false);

	// Track initial IDs for cross-tab navigation from DocumentsTab
	let initialJournalEntryId = $state<string | null>(null);
	let initialEventId = $state<string | null>(null);

	async function loadProfile() {
		try {
			profile = await getProfile(profileId);
		} catch {
			// Error handled by parent page
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
		<CalendarPanel {profileId} profileName={profile?.name} initialEventId={initialEventId} />
	</div>
	<div hidden={activeTab !== 'journal'}>
		<JournalPanel {profileId} initialEntryId={initialJournalEntryId} />
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
