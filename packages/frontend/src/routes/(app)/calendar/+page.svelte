<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		listProfiles,
		listEvents,
		createEvent,
		updateEvent,
		deleteEvent,
		type Event,
		type CareProfile,
		type CreateEventInput
	} from '$lib/api';
	import EventModal from '$lib/EventModal.svelte';
	import DeleteConfirmModal from '$lib/DeleteConfirmModal.svelte';

	let profiles = $state<CareProfile[]>([]);
	let selectedProfileId = $state<string>('all');
	let events = $state<Event[]>([]);
	let loadError = $state('');
	let loading = $state(true);

	// Calendar state
	let currentDate = $state(new Date());
	let selectedDate = $state<Date | null>(null);

	// Modal state
	let showEventModal = $state(false);
	let editingEvent = $state<Event | null>(null);
	let deleteModalEvent = $state<Event | null>(null);
	let showProfileSelector = $state(false);
	let pendingEventData = $state<CreateEventInput | null>(null);

	// Computed values
	const currentYear = $derived(currentDate.getFullYear());
	const currentMonth = $derived(currentDate.getMonth());

	// Get month name
	const monthName = $derived(
		new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate)
	);

	// Get days in month grid (includes previous/next month days for full grid)
	const calendarDays = $derived.by(() => {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const startDay = firstDay.getDay(); // 0 = Sunday
		const daysInMonth = lastDay.getDate();

		const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

		// Previous month days to fill the grid
		const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
		for (let i = startDay - 1; i >= 0; i--) {
			days.push({
				date: new Date(currentYear, currentMonth - 1, prevMonthLastDay - i),
				isCurrentMonth: false
			});
		}

		// Current month days
		for (let i = 1; i <= daysInMonth; i++) {
			days.push({
				date: new Date(currentYear, currentMonth, i),
				isCurrentMonth: true
			});
		}

		// Next month days to complete the grid
		const remainingDays = 42 - days.length; // 6 weeks * 7 days
		for (let i = 1; i <= remainingDays; i++) {
			days.push({
				date: new Date(currentYear, currentMonth + 1, i),
				isCurrentMonth: false
			});
		}

		return days;
	});

	// Get events for a specific date
	function getEventsForDate(date: Date): Event[] {
		const dateStr = date.toISOString().split('T')[0];
		return events.filter((e) => {
			const eventDateStr = new Date(e.event_date).toISOString().split('T')[0];
			return eventDateStr === dateStr;
		});
	}

	// Filter events for selected date
	const selectedDateEvents = $derived.by(() => {
		if (!selectedDate) return [];
		return getEventsForDate(selectedDate);
	});

	// Upcoming events (next 30 days)
	const upcomingEvents = $derived.by(() => {
		const now = new Date();
		const thirtyDaysLater = new Date(now);
		thirtyDaysLater.setDate(now.getDate() + 30);

		return events
			.filter((e) => {
				const eventDate = new Date(e.event_date);
				return eventDate >= now && eventDate <= thirtyDaysLater;
			})
			.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
			.slice(0, 10);
	});

	onMount(async () => {
		try {
			profiles = await listProfiles();
			await loadEvents();
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			loadError = 'Failed to load data.';
		} finally {
			loading = false;
		}
	});

	async function loadEvents() {
		// Load events for current month ± 1 month
		const start = new Date(currentYear, currentMonth - 1, 1);
		const end = new Date(currentYear, currentMonth + 2, 0);

		const startStr = start.toISOString();
		const endStr = end.toISOString();

		try {
			if (selectedProfileId === 'all') {
				// Load events for all profiles
				const allEvents: Event[] = [];
				for (const profile of profiles) {
					const profileEvents = await listEvents(profile.id, startStr, endStr);
					allEvents.push(...profileEvents);
				}
				events = allEvents;
			} else {
				events = await listEvents(selectedProfileId, startStr, endStr);
			}
		} catch (err) {
			console.error('Failed to load events', err);
		}
	}

	function prevMonth() {
		currentDate = new Date(currentYear, currentMonth - 1, 1);
		loadEvents();
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1);
		loadEvents();
	}

	function selectDate(date: Date) {
		selectedDate = date;
	}

	function openCreateModal(date?: Date) {
		editingEvent = null;
		// Note: We intentionally don't pass the selected date to the modal as a default.
		// This allows users to freely choose the event date regardless of which day they clicked.
		// Users can still see which date they clicked via the selectedDate display below the calendar.
		if (date) {
			selectedDate = date;
		}
		showEventModal = true;
	}

	function openEditModal(event: Event) {
		editingEvent = event;
		showEventModal = true;
	}

	function closeEventModal() {
		showEventModal = false;
		editingEvent = null;
	}

	async function handleSave(data: CreateEventInput) {
		// When editing, use the event's profile; when creating, check if we need profile selection
		if (editingEvent) {
			try {
				const updated = await updateEvent(editingEvent.care_profile_id, editingEvent.id, data);
				events = events.map((e) => (e.id === updated.id ? updated : e));
				closeEventModal();
			} catch (err) {
				throw err;
			}
		} else {
			// Creating new event
			if (selectedProfileId === 'all' && profiles.length > 1) {
				// Need to ask user which profile
				pendingEventData = data;
				closeEventModal();
				showProfileSelector = true;
			} else {
				// Either a specific profile is selected, or there's only one profile
				const profileId = selectedProfileId === 'all' ? profiles[0]?.id : selectedProfileId;
				if (!profileId) return;

				try {
					const created = await createEvent(profileId, data);
					events = [...events, created];
					closeEventModal();
				} catch (err) {
					throw err;
				}
			}
		}
	}

	async function handleProfileSelect(profileId: string) {
		if (!pendingEventData) return;

		try {
			const created = await createEvent(profileId, pendingEventData);
			events = [...events, created];
			showProfileSelector = false;
			pendingEventData = null;
		} catch (err) {
			console.error('Failed to create event', err);
		}
	}

	function closeProfileSelector() {
		showProfileSelector = false;
		pendingEventData = null;
	}

	function openDeleteModal(event: Event) {
		deleteModalEvent = event;
	}

	function closeDeleteModal() {
		deleteModalEvent = null;
	}

	async function handleDeleteConfirm() {
		if (!deleteModalEvent) return;
		const eventToDelete = deleteModalEvent;
		try {
			await deleteEvent(eventToDelete.care_profile_id, eventToDelete.id);
			events = events.filter((e) => e.id !== eventToDelete.id);
			closeDeleteModal();
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

	function getProfileName(profileId: string): string {
		return profiles.find((p) => p.id === profileId)?.name ?? 'Unknown';
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

	$effect(() => {
		if (selectedProfileId) {
			loadEvents();
		}
	});
</script>

<div class="max-w-4xl mx-auto px-unit-3 py-unit-3">
	<div class="flex items-center justify-between mb-unit-3">
		<h2 class="text-h2 font-semibold text-text-primary">
			{selectedProfileId !== 'all' ? `${getProfileName(selectedProfileId)}'s Calendar` : 'Calendar'}
		</h2>
		{#if profiles.length > 0}
			<button
				onclick={() => openCreateModal()}
				class="bg-primary text-white rounded-card px-unit-2 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
			>
				+ Add Event
			</button>
		{/if}
	</div>

	{#if loading}
		<p class="text-text-secondary text-sm">Loading…</p>
	{:else if loadError}
		<div class="card">
			<p class="text-danger text-sm">{loadError}</p>
		</div>
	{:else if profiles.length === 0}
		<div class="card text-center py-unit-4">
			<p class="text-text-secondary mb-unit-2">Create a care profile first to add events</p>
			<button
				onclick={() => goto('/')}
				class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base hover:bg-blue-600 transition-colors"
			>
				Go to Profiles
			</button>
		</div>
	{:else}
		<!-- Profile Filter -->
		<div class="card mb-unit-3">
			<div class="flex items-center justify-between">
				<div class="flex-1">
					<label for="profile-filter" class="block text-sm font-medium text-text-primary mb-1">
						Viewing events for
					</label>
					<select
						id="profile-filter"
						bind:value={selectedProfileId}
						class="w-full max-w-xs border border-gray-300 rounded-card px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
					>
						<option value="all">All Profiles</option>
						{#each profiles as profile}
							<option value={profile.id}>{profile.name}</option>
						{/each}
					</select>
				</div>
				{#if selectedProfileId !== 'all'}
					<a
						href="/profiles/{selectedProfileId}"
						class="text-sm text-primary hover:underline font-medium"
					>
						View Profile
					</a>
				{/if}
			</div>
		</div>

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
				<h3 class="text-lg font-semibold text-text-primary">{monthName}</h3>
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
					{@const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()}
					<button
						onclick={() => selectDate(date)}
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
					<h3 class="text-h3 font-semibold text-text-primary">
						{formatEventDate(selectedDate.toISOString())}
					</h3>
					<button
						onclick={() => selectedDate && openCreateModal(selectedDate)}
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
											<h4 class="font-semibold text-text-primary">{event.title}</h4>
											<span
												class="text-xs bg-blue-50 text-primary rounded-full px-2 py-0.5 border border-blue-100"
											>
												{getEventTypeLabel(event.event_type)}
											</span>
										</div>
										<p class="text-sm text-text-secondary">{formatEventTime(event.event_date)}</p>
										{#if event.location}
											<p class="text-sm text-text-secondary">{event.location}</p>
										{/if}
										{#if event.notes}
											<p class="text-sm text-text-secondary mt-1">{event.notes}</p>
										{/if}
										<p class="text-xs text-text-secondary mt-1">
											{getProfileName(event.care_profile_id)}
										</p>
									</div>
									<div class="flex gap-1">
										<button
											onclick={() => openEditModal(event)}
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
											onclick={() => openDeleteModal(event)}
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
			<h3 class="text-h3 font-semibold text-text-primary mb-unit-2">Upcoming Events</h3>
			{#if upcomingEvents.length === 0}
				<p class="text-text-secondary text-sm">No upcoming events</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each upcomingEvents as event}
						<button
							onclick={() => {
								selectedDate = new Date(event.event_date);
								openEditModal(event);
							}}
							class="border border-gray-200 rounded-card p-3 text-left hover:bg-gray-50 transition-colors"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<h4 class="font-semibold text-text-primary">{event.title}</h4>
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
									<p class="text-xs text-text-secondary mt-1">
										{getProfileName(event.care_profile_id)}
									</p>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if showEventModal}
	<EventModal
		event={editingEvent}
		profileName={editingEvent
			? getProfileName(editingEvent.care_profile_id)
			: selectedProfileId !== 'all'
				? getProfileName(selectedProfileId)
				: null}
		onSave={handleSave}
		onClose={closeEventModal}
	/>
{/if}

{#if deleteModalEvent}
	<DeleteConfirmModal
		name={deleteModalEvent.title}
		onConfirm={handleDeleteConfirm}
		onClose={closeDeleteModal}
	/>
{/if}

{#if showProfileSelector}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
		role="dialog"
		aria-modal="true"
		aria-labelledby="profile-selector-title"
		onmousedown={(e) => e.target === e.currentTarget && closeProfileSelector()}
	>
		<div class="card w-full max-w-md">
			<h2 id="profile-selector-title" class="text-h3 font-semibold text-text-primary mb-unit-3">
				Select Profile
			</h2>
			<p class="text-sm text-text-secondary mb-unit-3">
				Choose which profile this event should be added to:
			</p>
			<div class="flex flex-col gap-2">
				{#each profiles as profile}
					<button
						onclick={() => handleProfileSelect(profile.id)}
						class="w-full p-3 border border-gray-300 rounded-card text-left hover:bg-gray-50 hover:border-primary transition-colors"
					>
						<p class="font-medium text-text-primary">{profile.name}</p>
						{#if profile.date_of_birth}
							<p class="text-xs text-text-secondary">
								Born {new Date(profile.date_of_birth).toLocaleDateString()}
							</p>
						{/if}
					</button>
				{/each}
			</div>
			<div class="flex justify-end pt-unit-3 mt-unit-3 border-t border-gray-200">
				<button
					onclick={closeProfileSelector}
					class="px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
