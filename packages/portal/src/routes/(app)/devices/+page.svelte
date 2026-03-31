<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listDevices, type Device } from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/error-utils';
	import DeviceCard from '$lib/DeviceCard.svelte';

	let devices = $state<Device[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let canRetry = $state(false);

	async function loadData() {
		loading = true;
		loadError = '';
		canRetry = false;

		try {
			devices = await listDevices();
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			loadError = getErrorMessage(err, 'load devices');
			canRetry = isRetryable(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	function handleSendPhoto(device: Device) {
		// Phase 3: Opens photo picker - placeholder for now
		console.log('Send photo to device:', device.id);
	}

	function handleCall(device: Device) {
		// Initiates call to device - placeholder for now
		console.log('Call device:', device.id);
	}
</script>

<div class="max-w-2xl mx-auto px-unit-3 py-unit-3">
	<div class="flex items-center justify-between mb-unit-3">
		<h2 class="text-h2 font-semibold text-text-primary">Devices</h2>
		{#if devices.length > 0}
			<a
				href="/devices/pair"
				class="bg-primary text-white rounded-card px-unit-2 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
			>
				+ Pair New Tablet
			</a>
		{/if}
	</div>

	{#if loading}
		<p class="text-text-secondary text-sm">Loading…</p>
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
	{:else if devices.length === 0}
		<!-- Empty State -->
		<div class="card text-center py-unit-4">
			<!-- Tablet illustration -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="w-16 h-16 text-gray-300 mx-auto mb-unit-3"
				aria-hidden="true"
			>
				<path d="M10.5 18a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" />
				<path
					fill-rule="evenodd"
					d="M7.125 1.5A3.375 3.375 0 0 0 3.75 4.875v14.25A3.375 3.375 0 0 0 7.125 22.5h9.75a3.375 3.375 0 0 0 3.375-3.375V4.875A3.375 3.375 0 0 0 16.875 1.5h-9.75ZM6 4.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125 1.125h-9.75A1.125 1.125 0 0 1 6 19.125V4.875Z"
					clip-rule="evenodd"
				/>
			</svg>
			<h3 class="text-lg font-semibold text-text-primary mb-unit-1">No tablets paired yet</h3>
			<p class="text-text-secondary mb-unit-3 max-w-sm mx-auto">
				Pair a tablet to let your family see appointments and video call with one tap.
			</p>
			<a
				href="/devices/pair"
				class="inline-flex items-center justify-center border-2 border-dashed border-primary text-primary rounded-card px-unit-3 py-2 font-semibold text-base hover:bg-primary/5 transition-colors"
			>
				+ Pair Your First Tablet
			</a>
		</div>
	{:else}
		<!-- Device List -->
		<div class="space-y-unit-2">
			{#each devices as device (device.id)}
				<DeviceCard {device} onSendPhoto={handleSendPhoto} onCall={handleCall} />
			{/each}

			<!-- Add new device card (dashed border style) -->
			<a
				href="/devices/pair"
				class="block w-full p-unit-3 rounded-card border-2 border-dashed border-gray-300 text-center text-text-secondary hover:border-primary hover:text-primary transition-colors"
			>
				+ Pair New Tablet
			</a>
		</div>
	{/if}
</div>
