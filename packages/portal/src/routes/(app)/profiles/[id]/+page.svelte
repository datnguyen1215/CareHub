<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		getProfile,
		updateProfile,
		deleteProfile,
		listMedications,
		createMedication,
		updateMedication,
		listEvents,
		createEvent,
		updateEvent,
		deleteEvent,
		createJournalEntry,
		updateJournalEntry,
		uploadFile,
		listAttachments,
		listDevices,
		type CareProfile,
		type Medication,
		type Event as ApiEvent,
		type JournalEntry,
		type Device,
		type CreateProfileInput,
		type CreateMedicationInput,
		type CreateEventInput,
		type CreateJournalEntryInput
	} from '$lib/api';
	import DeviceStatusDot from '$lib/DeviceStatusDot.svelte';
	import BatteryIndicator from '$lib/BatteryIndicator.svelte';
	import { getErrorMessage, isRetryable } from '$lib/error-utils';
	import ProfileModal from '$lib/ProfileModal.svelte';
	import MedicationModal from '$lib/MedicationModal.svelte';
	import EventModal from '$lib/EventModal.svelte';
	import DeleteConfirmModal from '$lib/DeleteConfirmModal.svelte';
	import JournalTab from '$lib/JournalTab.svelte';
	import JournalEntryModal from '$lib/JournalEntryModal.svelte';
	import JournalEntryDetail from '$lib/JournalEntryDetail.svelte';
	import EventDetail from '$lib/EventDetail.svelte';
	import DocumentsTab from '$lib/DocumentsTab.svelte';
	import { toast } from '$lib/stores/toast';
	import { initiateCall, subscribe as subscribeCall, endCall, toggleMute, toggleVideo, type CallState } from '$lib/stores/call.svelte';
	import CallModal from '$lib/components/call/CallModal.svelte';

	const profileId = $derived($page.params.id ?? '');

	let profile = $state<CareProfile | null>(null);
	let recentMeds = $state<Medication[]>([]);
	let medications = $state<Medication[]>([]);
	let upcomingEvents = $state<ApiEvent[]>([]);
	let profileDevices = $state<Device[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let showDiscontinued = $state(false);
	let loadingMeds = $state(false);
	let canRetry = $state(false);
	let medError = $state('');

	let activeTab = $state<'overview' | 'meds' | 'calendar' | 'journal' | 'documents'>('overview');
	let showEditModal = $state(false);
	let showMedModal = $state(false);
	let editingMedication = $state<Medication | null>(null);

	// Journal state
	let showJournalModal = $state(false);
	let editingJournalEntry = $state<JournalEntry | null>(null);
	let viewingJournalEntryId = $state<string | null>(null);
	let journalTabKey = $state(0);

	// Calendar state
	let calendarEvents = $state<ApiEvent[]>([]);
	let currentDate = $state(new Date());
	let selectedDate = $state<Date | null>(null);
	let showEventModal = $state(false);
	let editingEvent = $state<ApiEvent | null>(null);
	let deleteModalEvent = $state<ApiEvent | null>(null);
	let calendarState = $state<'idle' | 'loading' | 'loaded'>('idle');
	let loadedMonthKey = $state<string | null>(null);
	let viewingEventId = $state<string | null>(null);

	// Derive calendarLoading for UI display
	const calendarLoading = $derived(calendarState === 'loading');

	// Track which events have attachments (event_id -> count)
	let eventAttachmentCounts = $state<Record<string, number>>({});

	// Call state subscription
	let localCallState = $state<CallState>({
		status: 'idle',
		sessionId: null,
		targetDeviceId: null,
		targetDeviceName: null,
		localStream: null,
		remoteStream: null,
		startedAt: null,
		duration: 0,
		error: null,
		isMuted: false,
		isVideoOff: false
	});
	let unsubscribeCall: (() => void) | null = null;

	// Call modal state
	const showCallModal = $derived(localCallState.status !== 'idle');

	// Profile delete state
	let showDeleteProfileModal = $state(false);

	// Calendar computed values
	const currentYear = $derived(currentDate.getFullYear());
	const currentMonth = $derived(currentDate.getMonth());
	const currentMonthKey = $derived(`${currentYear}-${currentMonth}`);

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

	function getEventsForDate(date: Date): ApiEvent[] {
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
			const [profileData, medsData, eventsData] = await Promise.all([
				getProfile(profileId),
				listMedications(profileId),
				listEvents(profileId)
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

			// Fetch devices separately - non-blocking so profile page still loads if devices API fails
			try {
				const devicesData = await listDevices();
				profileDevices = devicesData.filter((d) => d.profiles.some((p) => p.id === profileId));
			} catch {
				// Device fetch failed - show empty state, don't block profile page
				profileDevices = [];
			}
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
		// Subscribe to call state changes for cross-module reactivity
		unsubscribeCall = subscribeCall((state) => {
			localCallState = state;
		});
	});

	onDestroy(() => {
		if (unsubscribeCall) unsubscribeCall();
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
		if (!profile) return;
		const updated = await updateProfile(profile.id, data);
		profile = updated;
		showEditModal = false;
	}

	async function toggleDiscontinued() {
		showDiscontinued = !showDiscontinued;
		loadingMeds = true;
		medError = '';
		try {
			medications = await listMedications(profileId, showDiscontinued);
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
		if (editingMedication) {
			const updated = await updateMedication(profileId, editingMedication.id, data);
			medications = medications.map((m) => (m.id === updated.id ? updated : m));
			if (!showDiscontinued && updated.status === 'discontinued') {
				medications = medications.filter((m) => m.id !== updated.id);
			}
		} else {
			const created = await createMedication(profileId, data);
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
		if (editingJournalEntry) {
			await updateJournalEntry(profileId, editingJournalEntry.id, data);
		} else {
			await createJournalEntry(profileId, data);
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
		// Guard: prevent concurrent fetches
		if (calendarState === 'loading') return;

		calendarState = 'loading';

		const start = new Date(currentYear, currentMonth - 1, 1);
		const end = new Date(currentYear, currentMonth + 2, 0);

		try {
			calendarEvents = await listEvents(profileId, start.toISOString(), end.toISOString());
			// Fetch attachment counts for all loaded events
			await loadEventAttachmentCounts(calendarEvents.map((e) => e.id));
		} catch (err) {
			console.error('Failed to load calendar events', err);
		} finally {
			loadedMonthKey = currentMonthKey;
			calendarState = 'loaded';
		}
	}

	async function loadEventAttachmentCounts(eventIds: string[]) {
		// Fetch all attachments for this profile and count by event_id
		try {
			const attachments = await listAttachments(profileId);
			const counts: Record<string, number> = {};
			for (const attachment of attachments) {
				if (attachment.event_id && eventIds.includes(attachment.event_id)) {
					counts[attachment.event_id] = (counts[attachment.event_id] ?? 0) + 1;
				}
			}
			// Merge new counts with existing, preserving counts for events not in eventIds
			eventAttachmentCounts = { ...eventAttachmentCounts, ...counts };
			// Set count to 0 for requested events that have no attachments
			for (const id of eventIds) {
				if (!(id in counts)) {
					eventAttachmentCounts[id] = 0;
				}
			}
		} catch (err) {
			console.error('Failed to load attachment counts', err);
		}
	}

	function hasAttachments(eventId: string): boolean {
		return (eventAttachmentCounts[eventId] ?? 0) > 0;
	}

	// Re-fetch all events (without date range) to update overview's upcoming events
	async function refreshUpcomingEvents() {
		try {
			const allEvents = await listEvents(profileId);
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
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1);
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

	function openEditEvent(event: ApiEvent) {
		editingEvent = event;
		viewingEventId = null;
		showEventModal = true;
	}

	function openEventDetail(event: ApiEvent) {
		viewingEventId = event.id;
	}

	function closeEventModal() {
		showEventModal = false;
		editingEvent = null;
	}

	function handleEventEditFromDetail(event: ApiEvent) {
		viewingEventId = null;
		openEditEvent(event);
	}

	async function handleEventDeleted() {
		if (!viewingEventId) return;
		// Remove from calendar events
		calendarEvents = calendarEvents.filter((e) => e.id !== viewingEventId);
		// Also remove from attachment counts
		const newCounts = { ...eventAttachmentCounts };
		delete newCounts[viewingEventId];
		eventAttachmentCounts = newCounts;
		viewingEventId = null;
		// Refresh upcoming events for overview
		await refreshUpcomingEvents();
	}

	async function handleEventSave(data: CreateEventInput) {
		if (editingEvent) {
			const updated = await updateEvent(profileId, editingEvent.id, data);
			calendarEvents = calendarEvents.map((e) => (e.id === updated.id ? updated : e));
		} else {
			const created = await createEvent(profileId, data);
			calendarEvents = [...calendarEvents, created];
		}

		// Re-fetch all events to properly update overview upcoming events (not limited to calendar window)
		await refreshUpcomingEvents();

		toast.success(editingEvent ? 'Event updated' : 'Event added');
		closeEventModal();
	}

	function openDeleteEventModal(event: ApiEvent) {
		deleteModalEvent = event;
	}

	function closeDeleteEventModal() {
		deleteModalEvent = null;
	}

	async function handleDeleteEventConfirm() {
		if (!deleteModalEvent) return;
		const eventToDelete = deleteModalEvent;
		try {
			await deleteEvent(profileId, eventToDelete.id);
			calendarEvents = calendarEvents.filter((e) => e.id !== eventToDelete.id);

			// Re-fetch all events to properly update overview upcoming events (not limited to calendar window)
			await refreshUpcomingEvents();

			toast.destructive('Event deleted');
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

	// Load calendar events when switching to calendar tab or changing months
	$effect(() => {
		if (activeTab === 'calendar' && loadedMonthKey !== currentMonthKey) {
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

	// Avatar upload state
	let avatarUploading = $state(false);
	let avatarError = $state('');
	let avatarFileInput: HTMLInputElement;

	function getInitial(name: string): string {
		return name.charAt(0).toUpperCase();
	}

	function handleAvatarClick() {
		if (!avatarUploading) {
			avatarError = '';
			avatarFileInput?.click();
		}
	}

	async function handleAvatarChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !profile) return;

		avatarError = '';

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			avatarError = 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.';
			input.value = '';
			return;
		}

		// Validate file size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			avatarError = 'File too large. Maximum size is 5MB.';
			input.value = '';
			return;
		}

		avatarUploading = true;
		try {
			const url = await uploadFile(file);
			const updated = await updateProfile(profile.id, { avatar_url: url });
			profile = updated;
			toast.success('Photo updated');
		} catch (err: unknown) {
			avatarError = getErrorMessage(err, 'upload photo');
		} finally {
			avatarUploading = false;
			input.value = '';
		}
	}

	// Profile delete handlers
	function openDeleteProfileModal() {
		showDeleteProfileModal = true;
	}

	function closeDeleteProfileModal() {
		showDeleteProfileModal = false;
	}

	async function handleDeleteProfileConfirm() {
		if (!profile) return;
		await deleteProfile(profile.id);
		toast.destructive('Profile deleted');
		goto('/profiles');
	}

	// Device action handlers
	function handleSendPhoto(device: Device) {
		// TODO: Implement send photo functionality
		toast.success(`Opening photo picker for ${device.name}...`);
	}

	function handleCall(device: Device) {
		initiateCall(device.id, device.name);
	}

	function handleRetryCall() {
		if (localCallState.targetDeviceId && localCallState.targetDeviceName) {
			initiateCall(localCallState.targetDeviceId, localCallState.targetDeviceName);
		}
	}

	function handleDeviceSettings(deviceId: string) {
		goto(`/devices/${deviceId}`);
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

		<!-- Avatar Header -->
		<div class="flex flex-col items-center mb-unit-3">
			<button
				onclick={handleAvatarClick}
				disabled={avatarUploading}
				class="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden
				       hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
				       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
				aria-label="Change profile photo"
			>
				{#if profile.avatar_url}
					<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
				{:else}
					<span class="text-primary font-semibold text-3xl">{getInitial(profile.name)}</span>
				{/if}

				<!-- Camera overlay -->
				<div
					class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0
					       hover:opacity-100 transition-opacity"
					class:opacity-100={avatarUploading}
				>
					{#if avatarUploading}
						<svg
							class="animate-spin text-white w-6 h-6"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="text-white w-6 h-6"
						>
							<path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
							<path
								fill-rule="evenodd"
								d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3H4.5a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.152-.177a1.56 1.56 0 0 0 1.11-.71l.821-1.317a2.685 2.685 0 0 1 2.332-1.39ZM12 12.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"
								clip-rule="evenodd"
							/>
						</svg>
					{/if}
				</div>
			</button>
			{#if avatarError}
				<p class="text-danger text-sm mt-unit-1 text-center">{avatarError}</p>
			{/if}
			<h2 class="text-h2 font-semibold text-text-primary mt-unit-2">{profile.name}</h2>
			{#if profile.relationship}
				<p class="text-text-secondary capitalize">{profile.relationship}</p>
			{/if}
		</div>

		<input
			bind:this={avatarFileInput}
			type="file"
			accept="image/jpeg,image/png,image/gif,image/webp"
			class="hidden"
			onchange={handleAvatarChange}
		/>

		<!-- Device card(s) -->
		{#if profileDevices.length > 0}
			{#each profileDevices as device (device.id)}
				{@const isOnline = device.status === 'online'}
				<div class="card mb-unit-2">
					<!-- Header: Device name and status -->
					<div class="flex items-center justify-between mb-unit-2">
						<div class="flex items-center gap-2">
							<span class="text-base">📱</span>
							<h3 class="text-base font-semibold text-text-primary">{device.name}</h3>
						</div>
						<div class="flex items-center gap-1.5">
							<DeviceStatusDot status={device.status} size="sm" />
							<span class="text-xs text-text-secondary capitalize">{device.status}</span>
						</div>
					</div>

					<!-- Battery level -->
					{#if device.battery_level !== null}
						<div class="mb-unit-2">
							<BatteryIndicator level={device.battery_level} />
						</div>
					{/if}

					<!-- Action buttons -->
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => handleSendPhoto(device)}
							disabled={!isOnline}
							class="flex-1 px-2 py-1.5 text-sm rounded-card border border-gray-300
								{isOnline
								? 'text-text-primary hover:bg-gray-50'
								: 'text-gray-400 cursor-not-allowed'} transition-colors"
							title={!isOnline ? 'Device is offline' : 'Send a photo to this device'}
						>
							📷 Send Photo
						</button>
						<button
							type="button"
							onclick={() => handleCall(device)}
							disabled={!isOnline}
							class="flex-1 px-2 py-1.5 text-sm rounded-card border border-gray-300
								{isOnline
								? 'text-text-primary hover:bg-gray-50'
								: 'text-gray-400 cursor-not-allowed'} transition-colors"
							title={!isOnline ? 'Device is offline' : 'Call this device'}
						>
							📞 Call
						</button>
						<button
							type="button"
							onclick={() => handleDeviceSettings(device.id)}
							class="px-2 py-1.5 text-sm rounded-card border border-gray-300 text-text-primary hover:bg-gray-50 transition-colors"
							title="Device settings"
						>
							⚙️
						</button>
					</div>
				</div>
			{/each}
		{:else}
			<!-- Empty state: no device linked -->
			<div class="card mb-unit-2 text-center py-unit-2">
				<p class="text-text-secondary text-sm mb-unit-1">No device linked</p>
				<button onclick={() => goto('/devices/pair')} class="text-sm text-primary hover:underline">
					+ Link Device
				</button>
			</div>
		{/if}

		<!-- Profile info card -->
		{#if profile.date_of_birth || (profile.conditions && profile.conditions.length > 0)}
			<div class="card mb-unit-2">
				{#if profile.date_of_birth}
					<dl class="flex flex-col gap-1.5 text-sm">
						<div class="flex gap-2">
							<dt class="text-text-secondary w-28 shrink-0">Date of birth</dt>
							<dd class="text-text-primary">{formatDate(profile.date_of_birth)}</dd>
						</div>
					</dl>
				{/if}

				{#if profile.conditions && profile.conditions.length > 0}
					<div class="flex flex-wrap gap-1.5" class:mt-unit-2={profile.date_of_birth}>
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
		{/if}

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

		<!-- Delete Profile button -->
		<div class="mt-unit-4 pt-unit-3 border-t border-gray-200">
			<button
				onclick={openDeleteProfileModal}
				class="w-full py-3 rounded-card border border-danger text-danger font-semibold text-base
				       hover:bg-danger hover:text-white transition-colors"
			>
				Delete Profile
			</button>
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
					<p class="text-text-secondary mb-unit-2">
						Track daily medications, dosages, and schedules. Add the first medication to get
						started.
					</p>
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
	{:else if activeTab === 'calendar' && profile}
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
									<button
										onclick={() => openEventDetail(event)}
										class="border border-gray-200 rounded-card p-3 text-left hover:bg-gray-50 transition-colors w-full"
									>
										<div class="flex items-start justify-between">
											<div class="flex-1">
												<div class="flex items-center gap-2 mb-1 flex-wrap">
													<h5 class="font-semibold text-text-primary">{event.title}</h5>
													<span
														class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100"
													>
														{getEventTypeLabel(event.event_type)}
													</span>
													{#if hasAttachments(event.id)}
														<span class="text-gray-400" title="Has attachments">📎</span>
													{/if}
												</div>
												<p class="text-sm text-text-secondary">
													{formatEventTime(event.event_date)}
												</p>
												{#if event.location}
													<p class="text-sm text-text-secondary">{event.location}</p>
												{/if}
												{#if event.notes}
													<p class="text-sm text-text-secondary mt-1 line-clamp-2">{event.notes}</p>
												{/if}
											</div>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												class="w-5 h-5 text-gray-400 flex-shrink-0"
											>
												<path
													fill-rule="evenodd"
													d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
													clip-rule="evenodd"
												/>
											</svg>
										</div>
									</button>
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
										openEventDetail(event);
									}}
									class="border border-gray-200 rounded-card p-3 text-left hover:bg-gray-50 transition-colors"
								>
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<div class="flex items-center gap-2 mb-1 flex-wrap">
												<h5 class="font-semibold text-text-primary">{event.title}</h5>
												<span
													class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100"
												>
													{getEventTypeLabel(event.event_type)}
												</span>
												{#if hasAttachments(event.id)}
													<span class="text-gray-400" title="Has attachments">📎</span>
												{/if}
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
	{:else if activeTab === 'journal' && profile}
		<!-- Journal Tab -->
		{#key journalTabKey}
			<JournalTab
				{profileId}
				onEntryClick={handleJournalEntryClick}
				onAddClick={openCreateJournal}
			/>
		{/key}
	{:else if activeTab === 'documents' && profile}
		<!-- Documents Tab -->
		<DocumentsTab
			{profileId}
			onNavigateToJournal={(journalId) => {
				viewingJournalEntryId = journalId;
				activeTab = 'journal';
			}}
			onNavigateToEvent={(eventId) => {
				viewingEventId = eventId;
				activeTab = 'calendar';
			}}
		/>
	{/if}
</div>

{#if showEditModal && profile}
	<ProfileModal {profile} onSave={handleEditSave} onClose={() => (showEditModal = false)} />
{/if}

{#if showMedModal}
	<MedicationModal medication={editingMedication} onSave={handleMedSave} onClose={closeMedModal} />
{/if}

{#if showJournalModal}
	<JournalEntryModal
		entry={editingJournalEntry}
		onSave={handleJournalSave}
		onClose={closeJournalModal}
	/>
{/if}

{#if viewingJournalEntryId}
	<JournalEntryDetail
		{profileId}
		entryId={viewingJournalEntryId}
		onClose={() => (viewingJournalEntryId = null)}
		onEdit={openEditJournal}
		onDeleted={handleJournalDeleted}
	/>
{/if}

{#if showEventModal}
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

{#if viewingEventId}
	<EventDetail
		{profileId}
		eventId={viewingEventId}
		onClose={async () => {
			if (viewingEventId) {
				await loadEventAttachmentCounts([viewingEventId]);
			}
			viewingEventId = null;
		}}
		onEdit={handleEventEditFromDetail}
		onDeleted={handleEventDeleted}
	/>
{/if}

{#if showDeleteProfileModal && profile}
	<DeleteConfirmModal
		name={profile.name}
		onConfirm={handleDeleteProfileConfirm}
		onClose={closeDeleteProfileModal}
	/>
{/if}

{#if showCallModal}
	<CallModal
		status={localCallState.status}
		deviceName={localCallState.targetDeviceName}
		localStream={localCallState.localStream}
		remoteStream={localCallState.remoteStream}
		duration={localCallState.duration}
		error={localCallState.error}
		isMuted={localCallState.isMuted}
		isVideoOff={localCallState.isVideoOff}
		onToggleMute={toggleMute}
		onToggleVideo={toggleVideo}
		onEndCall={endCall}
		onRetry={handleRetryCall}
	/>
{/if}
