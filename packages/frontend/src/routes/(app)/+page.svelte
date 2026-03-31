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
	import { toast } from '$lib/stores/toast';

	let profiles = $state<CareProfile[]>([]);
	let events = $state<Event[]>([]);
	let loadError = $state('');
	let loading = $state(true);

	// Range toggle state
	type RangeOption = 7 | 14 | 30;
	let selectedRange = $state<RangeOption>(7);
	const rangeOptions: RangeOption[] = [7, 14, 30];

	// Modal state
	let showEventModal = $state(false);
	let editingEvent = $state<Event | null>(null);
	let deleteModalEvent = $state<Event | null>(null);
	let showProfileSelector = $state(false);
	let pendingEventData = $state<CreateEventInput | null>(null);

	// Event with profile info for display
	interface EventWithProfile extends Event {
		profile: CareProfile;
	}

	// Group events by day
	interface DayGroup {
		label: string;
		dateKey: string;
		events: EventWithProfile[];
	}

	const upcomingEventsWithProfiles = $derived.by(() => {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const endDate = new Date(now);
		endDate.setDate(now.getDate() + selectedRange);

		const profileMap = new Map(profiles.map((p) => [p.id, p]));

		return events
			.filter((e) => {
				const eventDate = new Date(e.event_date);
				return eventDate >= now && eventDate < endDate;
			})
			.map((e) => ({
				...e,
				profile: profileMap.get(e.care_profile_id)!
			}))
			.filter((e) => e.profile) // Filter out any with missing profiles
			.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
	});

	const groupedEvents = $derived.by(() => {
		const groups: DayGroup[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);

		for (const event of upcomingEventsWithProfiles) {
			const eventDate = new Date(event.event_date);
			eventDate.setHours(0, 0, 0, 0);
			const dateKey = eventDate.toISOString().split('T')[0];

			let label: string;
			if (eventDate.getTime() === today.getTime()) {
				label = 'Today';
			} else if (eventDate.getTime() === tomorrow.getTime()) {
				label = 'Tomorrow';
			} else {
				label = new Intl.DateTimeFormat('en-US', {
					weekday: 'long',
					month: 'short',
					day: 'numeric'
				}).format(eventDate);
			}

			const existingGroup = groups.find((g) => g.dateKey === dateKey);
			if (existingGroup) {
				existingGroup.events.push(event);
			} else {
				groups.push({ label, dateKey, events: [event] });
			}
		}

		return groups;
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
		const now = new Date();
		const endDate = new Date(now);
		endDate.setDate(now.getDate() + 31); // Load 31 days to support all range options

		const startStr = now.toISOString();
		const endStr = endDate.toISOString();

		try {
			const allEvents: Event[] = [];
			for (const profile of profiles) {
				const profileEvents = await listEvents(profile.id, startStr, endStr);
				allEvents.push(...profileEvents);
			}
			events = allEvents;
		} catch (err) {
			console.error('Failed to load events', err);
		}
	}

	function openCreateModal() {
		editingEvent = null;
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
		if (editingEvent) {
			try {
				const updated = await updateEvent(editingEvent.care_profile_id, editingEvent.id, data);
				events = events.map((e) => (e.id === updated.id ? updated : e));
				toast.success('Event updated');
				closeEventModal();
			} catch (err) {
				throw err;
			}
		} else {
			// Creating new event
			if (profiles.length > 1) {
				// Need to ask user which profile
				pendingEventData = data;
				closeEventModal();
				showProfileSelector = true;
			} else if (profiles.length === 1) {
				// Only one profile, use it directly
				const profileId = profiles[0].id;
				try {
					const created = await createEvent(profileId, data);
					events = [...events, created];
					toast.success('Event added');
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
			toast.success('Event added');
			showProfileSelector = false;
			pendingEventData = null;
		} catch (err) {
			console.error('Failed to create event', err);
			toast.error('Failed to create event');
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
			toast.destructive('Event deleted');
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

	function getProfileName(profileId: string): string {
		return profiles.find((p) => p.id === profileId)?.name ?? 'Unknown';
	}

	function getProfileInitial(profile: CareProfile): string {
		return profile.name.charAt(0).toUpperCase();
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

	function getEventTypeColor(type: string): string {
		const colors: Record<string, string> = {
			doctor_visit: 'bg-blue-50 text-blue-700 border-blue-200',
			lab_work: 'bg-purple-50 text-purple-700 border-purple-200',
			therapy: 'bg-green-50 text-green-700 border-green-200',
			general: 'bg-gray-50 text-gray-700 border-gray-200'
		};
		return colors[type] ?? 'bg-gray-50 text-gray-700 border-gray-200';
	}
</script>

<div class="max-w-4xl mx-auto px-unit-3 py-unit-3">
	<div class="flex items-center justify-between mb-unit-3">
		<h2 class="text-h2 font-semibold text-text-primary">Upcoming Events</h2>
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
				onclick={() => goto('/profiles')}
				class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base hover:bg-blue-600 transition-colors"
			>
				Go to Profiles
			</button>
		</div>
	{:else}
		<!-- Range Toggle -->
		<div class="card mb-unit-3">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-text-primary">Showing</span>
				<div class="flex gap-1">
					{#each rangeOptions as days}
						<button
							onclick={() => (selectedRange = days)}
							class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors
								{selectedRange === days
								? 'bg-primary text-white'
								: 'bg-gray-100 text-text-secondary hover:bg-gray-200'}"
						>
							{days} days
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Events List -->
		{#if groupedEvents.length === 0}
			<div class="card text-center py-unit-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-12 h-12 text-gray-300 mx-auto mb-unit-2"
					aria-hidden="true"
				>
					<path
						d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
					/>
					<path
						fill-rule="evenodd"
						d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="text-text-secondary mb-unit-2">
					No upcoming events in the next {selectedRange} days
				</p>
				<button
					onclick={() => openCreateModal()}
					class="bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base hover:bg-blue-600 transition-colors"
				>
					+ Add Event
				</button>
			</div>
		{:else}
			<div class="flex flex-col gap-unit-3">
				{#each groupedEvents as group}
					<div>
						<!-- Day Header -->
						<h3 class="text-sm font-semibold text-text-secondary mb-unit-1 uppercase tracking-wide">
							{group.label}
						</h3>

						<!-- Events for this day -->
						<div class="flex flex-col gap-unit-1">
							{#each group.events as event}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									onclick={() => openEditModal(event)}
									onkeydown={(e) => e.key === 'Enter' && openEditModal(event)}
									role="button"
									tabindex="0"
									class="card w-full text-left hover:shadow-md transition-shadow active:opacity-90 cursor-pointer"
								>
									<div class="flex items-start gap-3">
										<!-- Profile Avatar -->
										<div
											class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0"
										>
											{#if event.profile.avatar_url}
												<img
													src={event.profile.avatar_url}
													alt=""
													class="w-full h-full object-cover"
												/>
											{:else}
												<span class="text-primary font-semibold text-sm">
													{getProfileInitial(event.profile)}
												</span>
											{/if}
										</div>

										<!-- Event Details -->
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-0.5 flex-wrap">
												<h4 class="font-semibold text-text-primary truncate">{event.title}</h4>
												<span
													class="text-xs rounded-full px-2 py-0.5 border {getEventTypeColor(
														event.event_type
													)}"
												>
													{getEventTypeLabel(event.event_type)}
												</span>
											</div>
											<p class="text-sm text-text-secondary">
												{formatEventTime(event.event_date)}
												{#if event.location}
													<span class="mx-1">·</span>
													{event.location}
												{/if}
											</p>
											<p class="text-xs text-text-secondary mt-0.5">{event.profile.name}</p>
										</div>

										<!-- Actions -->
										<div class="flex gap-1 flex-shrink-0">
											<button
												onclick={(e) => {
													e.stopPropagation();
													openDeleteModal(event);
												}}
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
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if showEventModal}
	<EventModal
		event={editingEvent}
		profileName={editingEvent ? getProfileName(editingEvent.care_profile_id) : null}
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
						class="w-full p-3 border border-gray-300 rounded-card text-left hover:bg-gray-50 hover:border-primary transition-colors flex items-center gap-3"
					>
						<div
							class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0"
						>
							{#if profile.avatar_url}
								<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
							{:else}
								<span class="text-primary font-semibold text-sm">
									{getProfileInitial(profile)}
								</span>
							{/if}
						</div>
						<div>
							<p class="font-medium text-text-primary">{profile.name}</p>
							{#if profile.date_of_birth}
								<p class="text-xs text-text-secondary">
									Born {new Date(profile.date_of_birth).toLocaleDateString()}
								</p>
							{/if}
						</div>
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
