<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		registerDevice,
		generatePairingToken,
		checkPairingStatus,
		getDeviceInfo
	} from '$lib/services/api';
	import { saveDeviceCredentials, getDeviceCredentials } from '$lib/services/storage';
	import { connect, onMessage } from '$lib/services/websocket';
	import QRCode from '$lib/components/QRCode.svelte';

	let pairingToken = $state<string | null>(null);
	let expiresAt = $state<Date | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let refreshTimer: ReturnType<typeof setInterval> | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let unsubscribe: (() => void) | null = null;

	onMount(async () => {
		await initialize();
	});

	onDestroy(() => {
		if (refreshTimer) clearInterval(refreshTimer);
		if (pollTimer) clearInterval(pollTimer);
		if (unsubscribe) unsubscribe();
	});

	async function initialize() {
		let creds = await getDeviceCredentials();

		// Register device if no credentials
		if (!creds) {
			try {
				const result = await registerDevice();
				await saveDeviceCredentials(result.deviceId, result.deviceToken);
				creds = { deviceId: result.deviceId, deviceToken: result.deviceToken };
			} catch (err) {
				error = 'Failed to register device. Please try again.';
				isLoading = false;
				return;
			}
		}

		// Check if already paired
		try {
			const info = await getDeviceInfo();
			if (info.pairedAt) {
				// Already paired - navigate away
				if (info.profiles.length === 1) {
					goto(`/profile/${info.profiles[0].id}`);
				} else {
					goto('/home');
				}
				return;
			}
		} catch {
			// Continue with pairing
		}

		// Generate pairing token and start listening
		await generateToken();
		await setupListeners();
	}

	async function generateToken() {
		try {
			isLoading = true;
			error = null;
			const result = await generatePairingToken();
			pairingToken = result.token;
			expiresAt = new Date(result.expiresAt);
			isLoading = false;

			// Auto-refresh token before expiry (4 minutes)
			if (refreshTimer) clearInterval(refreshTimer);
			refreshTimer = setInterval(
				async () => {
					await generateToken();
				},
				4 * 60 * 1000
			);
		} catch (err) {
			error = 'Failed to generate pairing code. Please try again.';
			isLoading = false;
		}
	}

	async function setupListeners() {
		// Try WebSocket first
		await connect();
		unsubscribe = onMessage((message) => {
			if (message.type === 'device_paired') {
				handlePaired();
			}
		});

		// Also poll as fallback
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = setInterval(async () => {
			try {
				const status = await checkPairingStatus();
				if (status.paired) {
					handlePaired();
				}
			} catch {
				// Ignore polling errors
			}
		}, 3000);
	}

	async function handlePaired() {
		// Clean up timers
		if (refreshTimer) clearInterval(refreshTimer);
		if (pollTimer) clearInterval(pollTimer);

		// Navigate to home/profile
		const info = await getDeviceInfo();
		if (info.profiles.length === 1) {
			goto(`/profile/${info.profiles[0].id}`);
		} else {
			goto('/home');
		}
	}
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-unit-4">
	<div class="text-center mb-unit-6">
		<h1 class="text-4xl font-bold text-text-primary mb-unit-2">CareHub Kiosk</h1>
		<p class="text-xl text-text-secondary">Scan this code with your CareHub app to pair</p>
	</div>

	{#if isLoading}
		<div
			class="w-[280px] h-[280px] bg-surface rounded-lg shadow-lg flex items-center justify-center"
		>
			<div
				class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"
			></div>
		</div>
	{:else if error}
		<div class="text-center">
			<p class="text-danger text-xl mb-unit-4">{error}</p>
			<button class="kiosk-button" onclick={generateToken}>Try Again</button>
		</div>
	{:else if pairingToken}
		<div class="bg-surface p-unit-4 rounded-card shadow-card">
			<QRCode value={pairingToken} size={280} />
		</div>

		<div class="mt-unit-4 text-center">
			<p class="text-2xl font-mono font-bold text-text-primary tracking-widest">{pairingToken}</p>
			<p class="text-text-secondary mt-unit-2">Or enter this code manually in the CareHub app</p>
		</div>

		{#if expiresAt}
			<p class="text-text-secondary mt-unit-4">Code refreshes automatically</p>
		{/if}
	{/if}

	<div class="mt-unit-8 text-center">
		<p class="text-lg text-text-secondary">Open the CareHub app on your phone</p>
		<p class="text-lg text-text-secondary">Go to Devices → Pair New Device</p>
	</div>
</div>
