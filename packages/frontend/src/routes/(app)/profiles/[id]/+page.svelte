<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		listGroups,
		getProfile,
		updateProfile,
		listMedications,
		createMedication,
		updateMedication,
		listEvents,
		createEvent,
		updateEvent,
		deleteEvent,
		createJournalEntry,
		updateJournalEntry,
		type CareProfile,
		type Medication,
		type Event,
		type JournalEntry,
		type CreateProfileInput,
		type CreateMedicationInput,
		type CreateEventInput,
		type CreateJournalEntryInput
	} from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/error-utils';
	import ProfileModal from '$lib/ProfileModal.svelte';
	import MedicationModal from '$lib/MedicationModal.svelte';
	import EventModal from '$lib/EventModal.svelte';
	import DeleteConfirmModal from '$lib/DeleteConfirmModal.svelte';
	import JournalTab from '$lib/JournalTab.svelte';
	import JournalEntryModal from '$lib/JournalEntryModal.svelte';
	import JournalEntryDetail from '$lib/JournalEntryDetail.svelte';

	const profileId = $derived($page.params.id ?? '');

	let groupId = $state<string | null>(null);
	let profile = $state<CareProfile | null>(null);
	let recentMeds = $state<Medication[]>([]);
	let medications = $state<Medication[]>([]);
	let upcomingEvents = $state<Event[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let showDiscontinued = $state(false);
	let loadingMeds = $state(false);
	let canRetry = $state(false);
	let medError = $state('');

	let activeTab = $state<'overview' | 'meds' | 'calendar' | 'journal'>('overview');
	let showEditModal = $state(false);
	let showMedModal = $state(false);
	let editingMedication = $state<Medication | null>(null);

	// Journal state
	let showJournalModal = $state(false);
	let editingJournalEntry = $state<JournalEntry | null>(null);
	let viewingJournalEntryId = $state<string | null>(null);
	let journalTabKey = $state(0);

	// Calendar state
	let calendarEvents = $state<Event[]>([]);
	let currentDate = $state(new Date());
	let selectedDate = $state<Date | null>(null);
	let showEventModal = $state(false);
	let editingEvent = $state<Event | null>(null);
	let deleteModalEvent = $state<Event | null>(null);
	let calendarLoading = $state(false);

	// Calendar computed values
	const currentYear = $derived(currentDate.getFullYear());
	const currentMonth = $derived(currentDate.getMonth());

	const monthName = $derived(
		new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate)
	);

	const calendarDays = $derived.by(() => {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const startDay = firstDay.getDay();
		const daysInMonth = lastDay.getDate();

		const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

		const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
		for (let i = startDay - 1; i >= 0; i--) {
			days.push({
				date: new Date(currentYear, currentMonth - 1, prevMonthLastDay - i),
				isCurrentMonth: false
			});
		}

		for (let i = 1; i <= daysInMonth; i++) {
			days.push({
				date: new Date(currentYear, currentMonth, i),
				isCurrentMonth: true
			});
		}

		const remainingDays = 42 - days.length;
		for (let i = 1; i <= remainingDays; i++) {
			days.push({
				date: new Date(currentYear, currentMonth + 1, i),
				isCurrentMonth: false
			});
		}

		return days;
	});

	function getEventsForDate(date: Date): Event[] {
		const dateStr = date.toISOString().split('T')[0];
		return calendarEvents.filter((e) => {
			const eventDateStr = new Date(e.event_date).toISOString().split('T')[0];
			return eventDateStr === dateStr;
		});
	}

	const selectedDateEvents = $derived.by(() => {
		if (!selectedDate) return [];
		return getEventsForDate(selectedDate);
	});

	const calendarUpcomingEvents = $derived.by(() => {
		const now = new Date();
		const thirtyDaysLater = new Date(now);
		thirtyDaysLater.setDate(now.getDate() + 30);

		return calendarEvents
			.filter((e) => {
				const eventDate = new Date(e.event_date);
				return eventDate >= now && eventDate <= thirtyDaysLater;
			})
			.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
			.slice(0, 10);
	});

	async function loadData() {
		loading = true;
		loadError = '';
		canRetry = false;

		try {
			const groups = await listGroups();
			if (groups.length === 0) {
				loadError = 'No group found. Please complete setup first.';
				return;
			}
			groupId = groups[0].id;
			const [profileData, medsData, eventsData] = await Promise.all([
				getProfile(groupId, profileId),
				listMedications(groupId, profileId),
				listEvents(groupId, profileId)
			]);
			profile = profileData;
			medications = medsData;
			recentMeds = medsData.filter((m) => m.status === 'active').slice(0, 3);

			// Filter upcoming events (future dates only)
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			upcomingEvents = eventsData
				.filter((e) => new Date(e.event_date) >= now)
				.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
				.slice(0, 3);
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

	onMount(() => {
		loadData();
	});

	function formatDate(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	function formatShortDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	async function handleEditSave(data: CreateProfileInput) {
		if (!groupId || !profile) return;
		const updated = await updateProfile(groupId, profile.id, data);
		profile = updated;
		showEditModal = false;
	}

	async function toggleDiscontinued() {
		if (!groupId) return;
		showDiscontinued = !showDiscontinued;
		loadingMeds = true;
		medError = '';
		try {
			medications = await listMedications(groupId, profileId, showDiscontinued);
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			medError = getErrorMessage(err, 'load medications');
			// Revert toggle state on error
			showDiscontinued = !showDiscontinued;
		} finally {
			loadingMeds = false;
		}
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
		if (!groupId) return;

		if (editingMedication) {
			const updated = await updateMedication(groupId, profileId, editingMedication.id, data);
			medications = medications.map((m) => (m.id === updated.id ? updated : m));
			if (!showDiscontinued && updated.status === 'discontinued') {
				medications = medications.filter((m) => m.id !== updated.id);
			}
		} else {
			const created = await createMedication(groupId, profileId, data);
			medications = [...medications, created];
		}

		// Refresh recent meds for overview tab
		recentMeds = medications.filter((m) => m.status === 'active').slice(0, 3);
		closeMedModal();
	}

	// Journal handlers
	function openCreateJournal() {
		editingJournalEntry = null;
		showJournalModal = true;
	}

	function openEditJournal(entry: JournalEntry) {
		editingJournalEntry = entry;
		showJournalModal = true;
		viewingJournalEntryId = null;
	}

	function closeJournalModal() {
		showJournalModal = false;
		editingJournalEntry = null;
	}

	async function handleJournalSave(data: CreateJournalEntryInput) {
		if (!groupId) return;

		if (editingJournalEntry) {
			await updateJournalEntry(groupId, profileId, editingJournalEntry.id, data);
		} else {
			await createJournalEntry(groupId, profileId, data);
		}

		closeJournalModal();
		// Force JournalTab to reload
		journalTabKey += 1;
	}

	function handleJournalEntryClick(entry: JournalEntry) {
		viewingJournalEntryId = entry.id;
	}

	function handleJournalDeleted() {
		viewingJournalEntryId = null;
		journalTabKey += 1;
	}

	// Calendar functions
	async function loadCalendarEvents() {
		if (!groupId) return;
		calendarLoading = true;

		const start = new Date(currentYear, currentMonth - 1, 1);
		const end = new Date(currentYear, currentMonth + 2, 0);

		try {
			calendarEvents = await listEvents(groupId, profileId, start.toISOString(), end.toISOString());
		} catch (err) {
			console.error('Failed to load calendar events', err);
		} finally {
			calendarLoading = false;
		}
	}

	// Re-fetch all events (without date range) to update overview's upcoming events
	async function refreshUpcomingEvents() {
		if (!groupId) return;
		try {
			const allEvents = await listEvents(groupId, profileId);
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			upcomingEvents = allEvents
				.filter((e) => new Date(e.event_date) >= now)
				.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
				.slice(0, 3);
		} catch (err) {
			console.error('Failed to refresh upcoming events', err);
		}
	}

	function prevMonth() {
		currentDate = new Date(currentYear, currentMonth - 1, 1);
		loadCalendarEvents();
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1);
		loadCalendarEvents();
	}

	function selectCalendarDate(date: Date) {
		selectedDate = date;
	}

	function openCreateEvent(date?: Date) {
		editingEvent = null;
		if (date) {
			selectedDate = date;
		}
		showEventModal = true;
	}

	function openEditEvent(event: Event) {
		editingEvent = event;
		showEventModal = true;
	}

	function closeEventModal() {
		showEventModal = false;
		editingEvent = null;
	}

	async function handleEventSave(data: CreateEventInput) {
		if (!groupId) return;

		if (editingEvent) {
			const updated = await updateEvent(groupId, profileId, editingEvent.id, data);
			calendarEvents = calendarEvents.map((e) => (e.id === updated.id ? updated : e));
		} else {
			const created = await createEvent(groupId, profileId, data);
			calendarEvents = [...calendarEvents, created];
		}

		// Re-fetch all events to properly update overview upcoming events (not limited to calendar window)
		await refreshUpcomingEvents();

		closeEventModal();
	}

	function openDeleteEventModal(event: Event) {
		deleteModalEvent = event;
	}

	function closeDeleteEventModal() {
		deleteModalEvent = null;
	}

	async function handleDeleteEventConfirm() {
		if (!groupId || !deleteModalEvent) return;
		const eventToDelete = deleteModalEvent;
		try {
			await deleteEvent(groupId, profileId, eventToDelete.id);
			calendarEvents = calendarEvents.filter((e) => e.id !== eventToDelete.id);

			// Re-fetch all events to properly update overview upcoming events (not limited to calendar window)
			await refreshUpcomingEvents();

			closeDeleteEventModal();
		} catch (err) {
			console.error('Failed to delete event', err);
		}
	}

	function formatEventTime(dateStr: string): string {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
	}

	function formatEventDate(dateStr: string): string {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	}

	function getEventTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			doctor_visit: 'Doctor Visit',
			lab_work: 'Lab Work',
			therapy: 'Therapy',
			general: 'General'
		};
		return labels[type] ?? type;
	}

	// Load calendar events when switching to calendar tab
	$effect(() => {
		if (activeTab === 'calendar' && groupId && calendarEvents.length === 0) {
			loadCalendarEvents();
		}
	});

	const SCHEDULE_LABELS: Record<string, string> = {
		morning: 'Morning',
		afternoon: 'Afternoon',
		evening: 'Evening',
		bedtime: 'Bedtime'
	};

	const activeMeds = $derived(medications.filter((m) => m.status === 'active'));
	const discontinuedMeds = $derived(medications.filter((m) => m.status === 'discontinued'));
</script>

<!-- Page-specific top bar (overrides the global TopBar for this page) -->
<div class="fixed top-0 left-0 right-0 bg-surface border-b border-gray-200 z-50">
	<div class="max-w-2xl mx-auto flex items-center justify-between px-unit-2 h-14">
		<!-- Back arrow -->
		<button
			onclick={() => goto('/')}
			class="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
			aria-label="Back to dashboard"
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
	</div>
</div>

<!-- Page content -->
<div class="max-w-2xl mx-auto px-unit-2 py-unit-3">
	{#if loading}
		<p class="text-text-secondary text-sm">Loading...</p>
	{:else if loadError}
		<div class="card">
			<p class="text-danger text-sm mb-unit-2">{loadError}</p>
			{#if canRetry}
				<button
					onclick={loadData}
					class="bg-primary text-white rounded-card px-unit-3 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
				>
					Retry
				</button>
			{/if}
		</div>
	{:else if activeTab === 'overview' && profile}
		<!-- Overview Tab -->

		<!-- Profile info card -->
		<div class="card mb-unit-2">
			<h2 class="text-h3 font-semibold text-text-primary mb-unit-2">{profile.name}</h2>

			<dl class="flex flex-col gap-1.5 text-sm">
				{#if profile.relationship}
					<div class="flex gap-2">
						<dt class="text-text-secondary w-28 shrink-0">Relationship</dt>
						<dd class="text-text-primary capitalize">{profile.relationship}</dd>
					</div>
				{/if}

				{#if profile.date_of_birth}
					<div class="flex gap-2">
						<dt class="text-text-secondary w-28 shrink-0">Date of birth</dt>
						<dd class="text-text-primary">{formatDate(profile.date_of_birth)}</dd>
					</div>
				{/if}
			</dl>

			{#if profile.conditions && profile.conditions.length > 0}
				<div class="mt-unit-2 flex flex-wrap gap-1.5">
					{#each profile.conditions as condition}
						<span
							class="text-xs bg-blue-50 text-primary rounded-full px-2.5 py-0.5 border border-blue-100"
						>
							{condition}
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Recent medications card -->
		<div class="card mb-unit-2">
			<div class="flex items-center justify-between mb-unit-2">
				<h3 class="text-base font-semibold text-text-primary">Recent Medications</h3>
				{#if recentMeds.length > 0}
					<button onclick={() => (activeTab = 'meds')} class="text-sm text-primary hover:underline">
						See all
					</button>
				{/if}
			</div>

			{#if recentMeds.length === 0}
				<p class="text-text-secondary text-sm">No medications added yet</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each recentMeds as med (med.id)}
						<li class="flex items-center gap-2 text-sm">
							<span class="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden="true"></span>
							<span class="text-text-primary font-medium">{med.name}</span>
							{#if med.dosage}
								<span class="text-text-secondary">{med.dosage}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Upcoming events card -->
		<div class="card">
			<div class="flex items-center justify-between mb-unit-2">
				<h3 class="text-base font-semibold text-text-primary">Upcoming</h3>
				{#if upcomingEvents.length > 0}
					<button
						onclick={() => (activeTab = 'calendar')}
						class="text-sm text-primary hover:underline"
					>
						See all
					</button>
				{/if}
			</div>

			{#if upcomingEvents.length === 0}
				<p class="text-text-secondary text-sm">No upcoming events</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each upcomingEvents as event (event.id)}
						<li class="flex items-center gap-2 text-sm">
							<span class="text-text-secondary shrink-0">{formatShortDate(event.event_date)}</span>
							<span class="text-text-primary font-medium truncate">{event.title}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if activeTab === 'meds' && profile}
		<!-- Meds Tab -->
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
					<p class="text-text-secondary mb-unit-2">No medications added yet</p>
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
	{:else if activeTab === 'calendar' && profile && groupId}
		<!-- Calendar Tab -->
		<div>
			<div class="flex items-center justify-between mb-unit-2">
				<h3 class="text-h3 font-semibold text-text-primary">Calendar</h3>
				<button
					onclick={() => openCreateEvent()}
					class="bg-primary text-white rounded-card px-unit-2 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
				>
					+ Add Event
				</button>
			</div>

			{#if calendarLoading}
				<p class="text-text-secondary text-sm">Loading calendar...</p>
			{:else}
				<!-- Calendar Grid -->
				<div class="card mb-unit-3">
					<!-- Calendar Header -->
					<div class="flex items-center justify-between mb-unit-3">
						<button
							onclick={prevMonth}
							class="p-2 hover:bg-gray-100 rounded-full transition-colors"
							aria-label="Previous month"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="w-5 h-5"
							>
								<path
									fill-rule="evenodd"
									d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
						<h4 class="text-lg font-semibold text-text-primary">{monthName}</h4>
						<button
							onclick={nextMonth}
							class="p-2 hover:bg-gray-100 rounded-full transition-colors"
							aria-label="Next month"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="w-5 h-5"
							>
								<path
									fill-rule="evenodd"
									d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</div>

					<!-- Weekday Headers -->
					<div class="grid grid-cols-7 gap-1 mb-2">
						{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
							<div class="text-center text-xs font-medium text-text-secondary py-2">{day}</div>
						{/each}
					</div>

					<!-- Calendar Days -->
					<div class="grid grid-cols-7 gap-1">
						{#each calendarDays as { date, isCurrentMonth }}
							{@const dayEvents = getEventsForDate(date)}
							{@const isToday = date.toDateString() === new Date().toDateString() && isCurrentMonth}
							{@const isSelected =
								selectedDate && date.toDateString() === selectedDate.toDateString()}
							<button
								onclick={() => selectCalendarDate(date)}
								class="aspect-square p-1 rounded-card text-sm transition-colors relative
									{isCurrentMonth ? 'text-text-primary' : 'text-text-secondary opacity-40'}
									{isToday ? 'bg-blue-50 border border-primary' : 'hover:bg-gray-50'}
									{isSelected ? 'ring-2 ring-primary' : ''}"
							>
								<span class="block">{date.getDate()}</span>
								{#if dayEvents.length > 0 && isCurrentMonth}
									<div class="flex justify-center gap-0.5 mt-0.5">
										{#each dayEvents.slice(0, 3) as _}
											<div class="w-1 h-1 rounded-full bg-primary"></div>
										{/each}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Selected Date Events -->
				{#if selectedDate}
					<div class="card mb-unit-3">
						<div class="flex items-center justify-between mb-unit-2">
							<h4 class="text-h3 font-semibold text-text-primary">
								{formatEventDate(selectedDate.toISOString())}
							</h4>
							<button
								onclick={() => selectedDate && openCreateEvent(selectedDate)}
								class="text-primary text-sm font-medium hover:underline"
							>
								+ Add Event
							</button>
						</div>
						{#if selectedDateEvents.length === 0}
							<p class="text-text-secondary text-sm">No events on this day</p>
						{:else}
							<div class="flex flex-col gap-2">
								{#each selectedDateEvents as event}
									<div class="border border-gray-200 rounded-card p-3">
										<div class="flex items-start justify-between">
											<div class="flex-1">
												<div class="flex items-center gap-2 mb-1">
													<h5 class="font-semibold text-text-primary">{event.title}</h5>
													<span
														class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100"
													>
														{getEventTypeLabel(event.event_type)}
													</span>
												</div>
												<p class="text-sm text-text-secondary">
													{formatEventTime(event.event_date)}
												</p>
												{#if event.location}
													<p class="text-sm text-text-secondary">{event.location}</p>
												{/if}
												{#if event.notes}
													<p class="text-sm text-text-secondary mt-1">{event.notes}</p>
												{/if}
											</div>
											<div class="flex gap-1">
												<button
													onclick={() => openEditEvent(event)}
													class="p-1.5 hover:bg-gray-100 rounded transition-colors"
													aria-label="Edit event"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														viewBox="0 0 20 20"
														fill="currentColor"
														class="w-4 h-4 text-gray-600"
													>
														<path
															d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"
														/>
														<path
															d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z"
														/>
													</svg>
												</button>
												<button
													onclick={() => openDeleteEventModal(event)}
													class="p-1.5 hover:bg-gray-100 rounded transition-colors"
													aria-label="Delete event"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														viewBox="0 0 20 20"
														fill="currentColor"
														class="w-4 h-4 text-gray-600"
													>
														<path
															fill-rule="evenodd"
															d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
															clip-rule="evenodd"
														/>
													</svg>
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Upcoming Events -->
				<div class="card">
					<h4 class="text-h3 font-semibold text-text-primary mb-unit-2">Upcoming Events</h4>
					{#if calendarUpcomingEvents.length === 0}
						<p class="text-text-secondary text-sm">No upcoming events</p>
					{:else}
						<div class="flex flex-col gap-2">
							{#each calendarUpcomingEvents as event}
								<button
									onclick={() => {
										selectedDate = new Date(event.event_date);
										openEditEvent(event);
									}}
									class="border border-gray-200 rounded-card p-3 text-left hover:bg-gray-50 transition-colors"
								>
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<div class="flex items-center gap-2 mb-1">
												<h5 class="font-semibold text-text-primary">{event.title}</h5>
												<span
													class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100"
												>
													{getEventTypeLabel(event.event_type)}
												</span>
											</div>
											<p class="text-sm text-text-secondary">
												{formatEventDate(event.event_date)} at {formatEventTime(event.event_date)}
											</p>
											{#if event.location}
												<p class="text-sm text-text-secondary">{event.location}</p>
											{/if}
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'journal' && profile && groupId}
		<!-- Journal Tab -->
		{#key journalTabKey}
			<JournalTab
				{groupId}
				{profileId}
				onEntryClick={handleJournalEntryClick}
				onAddClick={openCreateJournal}
			/>
		{/key}
	{/if}
</div>

{#if showEditModal && groupId && profile}
	<ProfileModal
		{groupId}
		{profile}
		onSave={handleEditSave}
		onClose={() => (showEditModal = false)}
	/>
{/if}

{#if showMedModal}
	<MedicationModal medication={editingMedication} onSave={handleMedSave} onClose={closeMedModal} />
{/if}

{#if showJournalModal && groupId}
	<JournalEntryModal
		{groupId}
		{profileId}
		entry={editingJournalEntry}
		onSave={handleJournalSave}
		onClose={closeJournalModal}
	/>
{/if}

{#if viewingJournalEntryId && groupId}
	<JournalEntryDetail
		{groupId}
		{profileId}
		entryId={viewingJournalEntryId}
		onClose={() => (viewingJournalEntryId = null)}
		onEdit={openEditJournal}
		onDeleted={handleJournalDeleted}
	/>
{/if}

{#if showEventModal && groupId}
	<EventModal
		event={editingEvent}
		profileName={profile?.name}
		onSave={handleEventSave}
		onClose={closeEventModal}
	/>
{/if}

{#if deleteModalEvent}
	<DeleteConfirmModal
		name={deleteModalEvent.title}
		onConfirm={handleDeleteEventConfirm}
		onClose={closeDeleteEventModal}
	/>
{/if}
