<script lang="ts">
	import { onMount } from 'svelte';
	import type { Event, CreateEventInput } from '$lib/api';
	import { createFocusTrap } from '$lib/utils/focusTrap';

	interface Props {
		event?: Event | null;
		profileName?: string | null;
		onSave: (data: CreateEventInput) => Promise<void>;
		onClose: () => void;
	}

	let { event = null, profileName = null, onSave, onClose }: Props = $props();

	const EVENT_TYPE_OPTIONS = [
		{ value: 'doctor_visit', label: 'Doctor Visit' },
		{ value: 'lab_work', label: 'Lab Work' },
		{ value: 'therapy', label: 'Therapy' },
		{ value: 'general', label: 'General' }
	] as const;

	type EventType = (typeof EVENT_TYPE_OPTIONS)[number]['value'];

	let title = $state(event?.title ?? '');
	let eventType = $state<EventType>(event?.event_type ?? 'general');
	let eventDate = $state(
		event?.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : ''
	);
	let location = $state(event?.location ?? '');
	let notes = $state(event?.notes ?? '');
	let error = $state('');
	let loading = $state(false);
	let modalElement: HTMLElement;

	const isEdit = $derived(!!event);

	onMount(() => {
		const cleanup = createFocusTrap(modalElement, onClose);
		return cleanup;
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (!title.trim()) {
			error = 'Title is required.';
			return;
		}

		if (!eventDate) {
			error = 'Event date is required.';
			return;
		}

		loading = true;
		try {
			const data: CreateEventInput = {
				title: title.trim(),
				event_type: eventType,
				event_date: new Date(eventDate).toISOString(),
				location: location.trim() || null,
				notes: notes.trim() || null
			};

			await onSave(data);
			// Toast is shown by parent component after successful creation/update
			// to avoid premature toast in multi-profile creation flow
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
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={modalElement}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
	role="dialog"
	aria-modal="true"
	aria-labelledby="event-modal-title"
	onmousedown={handleBackdropClick}
>
	<div class="card w-full max-w-md">
		<h2 id="event-modal-title" class="text-h3 font-semibold text-text-primary mb-unit-1">
			{isEdit ? 'Edit Event' : 'Add Event'}
		</h2>

		{#if profileName}
			<p class="text-sm text-text-secondary mb-unit-2">
				For: <span class="font-medium text-text-primary">{profileName}</span>
			</p>
		{/if}

		<form onsubmit={handleSubmit} class="flex flex-col gap-unit-2" novalidate>
			<!-- Title -->
			<div>
				<label for="event-title" class="block text-sm font-medium text-text-primary mb-1">
					Title <span class="text-danger">*</span>
				</label>
				<input
					id="event-title"
					type="text"
					bind:value={title}
					disabled={loading}
					required
					placeholder="e.g. Dr. Smith Appointment"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Event Type chips -->
			<div>
				<p class="block text-sm font-medium text-text-primary mb-1">
					Event Type <span class="text-danger">*</span>
				</p>
				<div class="flex flex-wrap gap-2">
					{#each EVENT_TYPE_OPTIONS as option}
						<button
							type="button"
							onclick={() => (eventType = option.value)}
							disabled={loading}
							class="px-3 py-2.5 rounded-full text-sm font-medium border transition-colors min-h-[44px]
							       {eventType === option.value
								? 'bg-primary text-white border-primary'
								: 'bg-surface text-text-secondary border-gray-300 hover:border-primary hover:text-primary'}
							       disabled:opacity-50"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Date/Time -->
			<div>
				<label for="event-date" class="block text-sm font-medium text-text-primary mb-1">
					Date & Time <span class="text-danger">*</span>
				</label>
				<input
					id="event-date"
					type="datetime-local"
					bind:value={eventDate}
					disabled={loading}
					required
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Location -->
			<div>
				<label for="event-location" class="block text-sm font-medium text-text-primary mb-1">
					Location <span class="text-text-secondary text-xs">(optional)</span>
				</label>
				<input
					id="event-location"
					type="text"
					bind:value={location}
					disabled={loading}
					placeholder="e.g. Main Street Clinic"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50"
				/>
			</div>

			<!-- Notes -->
			<div>
				<label for="event-notes" class="block text-sm font-medium text-text-primary mb-1">
					Notes <span class="text-text-secondary text-xs">(optional)</span>
				</label>
				<textarea
					id="event-notes"
					bind:value={notes}
					disabled={loading}
					placeholder="Additional information..."
					rows="3"
					class="w-full px-3 py-2 border border-gray-300 rounded-card text-base text-text-primary
					       bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
					       disabled:opacity-50 resize-none"
				></textarea>
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
					disabled={loading || !title.trim() || !eventDate}
					class="px-unit-3 py-2 rounded-card bg-primary text-white font-semibold text-base
					       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? 'Saving…' : 'Save'}
				</button>
			</div>
		</form>
	</div>
</div>
