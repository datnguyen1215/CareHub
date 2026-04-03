<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listEvents,
		createEvent,
		updateEvent,
		deleteEvent,
		listAttachments,
		type Event as ApiEvent,
		type CreateEventInput
	} from '$lib/api';
	import EventModal from '$lib/components/events/EventModal.svelte';
	import EventDetail from '$lib/components/events/EventDetail.svelte';
	import DeleteConfirmModal from '$lib/components/shared/DeleteConfirmModal.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	interface Props {
		profileId: string;
		profileName?: string | null;
	}

	let { profileId, profileName = null }: Props = $props();

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

	// Load calendar events on mount
	onMount(() => {
		loadCalendarEvents();
	});

	async function loadCalendarEvents() {
		if (calendarState === 'loading') return;

		calendarState = 'loading';

		const start = new Date(currentYear, currentMonth - 1, 1);
		const end = new Date(currentYear, currentMonth + 2, 0);

		try {
			calendarEvents = await listEvents(profileId, start.toISOString(), end.toISOString());
			await loadEventAttachmentCounts(calendarEvents.map((e) => e.id));
		} catch (err) {
			console.error('Failed to load calendar events', err);
		} finally {
			loadedMonthKey = currentMonthKey;
			calendarState = 'loaded';
		}
	}

	async function loadEventAttachmentCounts(eventIds: string[]) {
		try {
			const attachments = await listAttachments(profileId);
			const counts: Record<string, number> = {};
			for (const attachment of attachments) {
				if (attachment.event_id && eventIds.includes(attachment.event_id)) {
					counts[attachment.event_id] = (counts[attachment.event_id] ?? 0) + 1;
				}
			}
			eventAttachmentCounts = { ...eventAttachmentCounts, ...counts };
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
			// Note: This panel no longer updates overview upcoming events directly.
			// The overview panel manages its own upcoming events.
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
		calendarEvents = calendarEvents.filter((e) => e.id !== viewingEventId);
		const newCounts = { ...eventAttachmentCounts };
		delete newCounts[viewingEventId];
		eventAttachmentCounts = newCounts;
		viewingEventId = null;
	}

	async function handleEventSave(data: CreateEventInput) {
		if (editingEvent) {
			const updated = await updateEvent(profileId, editingEvent.id, data);
			calendarEvents = calendarEvents.map((e) => (e.id === updated.id ? updated : e));
		} else {
			const created = await createEvent(profileId, data);
			calendarEvents = [...calendarEvents, created];
		}

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

			const newCounts = { ...eventAttachmentCounts };
			delete newCounts[eventToDelete.id];
			eventAttachmentCounts = newCounts;

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

	// Load calendar events when changing months
	$effect(() => {
		if (loadedMonthKey !== currentMonthKey) {
			loadCalendarEvents();
		}
	});
</script>

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

{#if showEventModal}
	<EventModal
		event={editingEvent}
		profileName={profileName}
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
