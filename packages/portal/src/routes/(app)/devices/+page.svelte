<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listDevices, getLatestRelease, type Device, type Release } from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/utils/error-utils';
	import DeviceCard from '$lib/components/devices/DeviceCard.svelte';
	import {
		callState,
		initiateCall,
		endCall,
		toggleMute,
		toggleVideo
	} from '$lib/stores/call.svelte';
	import CallModal from '$lib/components/call/CallModal.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { seedDeviceStatuses, getDeviceStatus } from '$lib/stores/deviceStatus.svelte';

	let devices = $state<Device[]>([]);
	let latestRelease = $state<Release | null>(null);
	let loadError = $state('');
	let loading = $state(true);
	let canRetry = $state(false);

	let showCallModal = $derived(callState.status !== 'idle');

	async function loadData() {
		loading = true;
		loadError = '';
		canRetry = false;

		try {
			const [deviceList, releaseData] = await Promise.all([
				listDevices(),
				// Wrapped with .catch() so a missing/broken releases endpoint
				// does not prevent the device list from loading.
				getLatestRelease('kiosk').catch(() => undefined)
			]);
			devices = deviceList;
			seedDeviceStatuses(devices);
			latestRelease = releaseData ?? null;
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

	function handleCall(device: Device) {
		if (getDeviceStatus(device.id, device.status) !== 'online') {
			toast.warning('Device is offline. Cannot place call.');
			return;
		}
		initiateCall(device.id, device.name);
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
		<!-- Loading skeleton -->
		<div class="space-y-unit-2" aria-label="Loading devices">
			{#each Array(2) as _}
				<div class="card animate-pulse space-y-2">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-card bg-gray-200"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 bg-gray-200 rounded w-1/3"></div>
							<div class="h-3 bg-gray-200 rounded w-1/2"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
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
				<DeviceCard {device} {latestRelease} onCall={handleCall} />
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

{#if showCallModal}
	<CallModal
		status={callState.status}
		deviceName={callState.targetDeviceName}
		localStream={callState.localStream}
		remoteStream={callState.remoteStream}
		duration={callState.duration}
		error={callState.error}
		isMuted={callState.isMuted}
		isVideoOff={callState.isVideoOff}
		onToggleMute={toggleMute}
		onToggleVideo={toggleVideo}
		onEndCall={() => endCall()}
		onRetry={() => initiateCall(callState.targetDeviceId!, callState.targetDeviceName!)}
	/>
{/if}
