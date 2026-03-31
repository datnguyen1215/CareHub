<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		getDeviceCredentials,
		clearDeviceCredentials,
		saveDeviceCredentials
	} from '$lib/services/storage';
	import { getDeviceInfo, registerDevice, type DeviceInfo } from '$lib/services/api';
	import { connect, disconnect, onMessage, getIsConnected } from '$lib/services/websocket';
	import type { DeviceState } from '$lib/stores/device';
	import { initialDeviceState } from '$lib/stores/device';
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import CallOverlay from '$lib/components/call/CallOverlay.svelte';

	interface Props {
		children?: import('svelte').Snippet;
	}
	let { children }: Props = $props();

	let deviceState: DeviceState = $state({ ...initialDeviceState });
	let isConnected = $state(false);
	let unsubscribe: (() => void) | null = null;
	let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await initializeDevice();
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
		if (connectionCheckInterval) clearInterval(connectionCheckInterval);
		disconnect();
	});

	async function initializeDevice() {
		const creds = await getDeviceCredentials();

		if (!creds) {
			// No credentials - need to register
			deviceState.isLoading = false;
			if (page.url.pathname !== '/pairing') {
				goto('/pairing');
			}
			return;
		}

		try {
			// Validate token and get device info
			const info = await getDeviceInfo();
			updateDeviceState(info);

			// Connect WebSocket if paired
			if (info.pairedAt) {
				await setupWebSocket();
			}

			// Navigate based on state
			if (!info.pairedAt) {
				goto('/pairing');
			} else if (info.profiles.length === 0) {
				// Paired but no profiles assigned - show waiting screen
				goto('/home');
			} else if (info.profiles.length === 1) {
				// Single profile - go directly to dashboard
				goto(`/profile/${info.profiles[0].id}`);
			} else {
				// Multiple profiles - show selection
				goto('/home');
			}
		} catch {
			// Token invalid or network error
			await clearDeviceCredentials();
			deviceState.isLoading = false;
			goto('/pairing');
		}
	}

	function updateDeviceState(info: DeviceInfo) {
		deviceState = {
			deviceId: info.id,
			name: info.name,
			isPaired: info.pairedAt !== null,
			isLoading: false,
			profiles: info.profiles,
			caretakers: info.caretakers,
			error: null
		};
	}

	async function setupWebSocket() {
		await connect();

		// Listen for WebSocket messages
		unsubscribe = onMessage((message) => {
			switch (message.type) {
				case 'device_paired':
					handleDevicePaired(message.payload as { profiles: DeviceInfo['profiles'] });
					break;

				case 'device_revoked':
					handleDeviceRevoked();
					break;

				case 'profiles_updated':
					handleProfilesUpdated(message.payload as { profiles: DeviceInfo['profiles'] });
					break;

				case 'connected':
					isConnected = true;
					break;
			}
		});

		// Check connection status periodically
		connectionCheckInterval = setInterval(() => {
			isConnected = getIsConnected();
		}, 1000);
	}

	function handleDevicePaired(payload: { profiles: DeviceInfo['profiles'] }) {
		deviceState.isPaired = true;
		deviceState.profiles = payload.profiles;

		// Navigate to appropriate screen
		if (payload.profiles.length === 1) {
			goto(`/profile/${payload.profiles[0].id}`);
		} else {
			goto('/home');
		}
	}

	async function handleDeviceRevoked() {
		await clearDeviceCredentials();
		disconnect();
		deviceState = { ...initialDeviceState, isLoading: false };
		goto('/pairing');
	}

	function handleProfilesUpdated(payload: { profiles: DeviceInfo['profiles'] }) {
		deviceState.profiles = payload.profiles;
	}
</script>

<svelte:head>
	<title>CareHub Kiosk</title>
</svelte:head>

<div class="min-h-screen bg-background flex flex-col">
	{#if deviceState.isPaired}
		<ConnectionStatus connected={isConnected} />
	{/if}

	<main class="flex-1">
		{@render children?.()}
	</main>

	<!-- Global call overlay - renders on top of all content when call is active -->
	{#if deviceState.isPaired}
		<CallOverlay />
	{/if}
</div>
