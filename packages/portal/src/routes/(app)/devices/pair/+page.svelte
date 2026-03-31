<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listProfiles, pairDevice, type CareProfile, type Device } from '$lib/api';
	import { getErrorMessage } from '$lib/error-utils';
	import QRScanner from '$lib/QRScanner.svelte';
	import ProfileSelector from '$lib/ProfileSelector.svelte';

	type Step = 'scan' | 'profiles' | 'confirm' | 'success';

	let currentStep = $state<Step>('scan');
	let scannedToken = $state('');
	let profiles = $state<CareProfile[]>([]);
	let selectedProfileIds = $state<string[]>([]);
	let deviceName = $state('New Tablet');
	let loading = $state(false);
	let error = $state('');
	let pairedDevice = $state<Device | null>(null);

	onMount(async () => {
		try {
			profiles = await listProfiles();
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			error = getErrorMessage(err, 'load profiles');
		}
	});

	function handleScan(data: string) {
		// Data could be a full URL or just a token
		// Extract token if it's a URL like https://carehub.app/pair?token=ABC123
		let token = data;
		try {
			const url = new URL(data);
			const tokenParam = url.searchParams.get('token');
			if (tokenParam) {
				token = tokenParam;
			}
		} catch {
			// Not a URL, use data as token directly
		}

		scannedToken = token.toUpperCase();
		currentStep = 'profiles';
	}

	function handleScanError(errorMsg: string) {
		// Don't show error for camera permission - QRScanner handles fallback
		if (!errorMsg.includes('Camera access denied')) {
			error = errorMsg;
		}
	}

	function handleProfileSelectionChange(ids: string[]) {
		selectedProfileIds = ids;
	}

	function goToConfirm() {
		if (selectedProfileIds.length === 0) {
			error = 'Please select at least one profile';
			return;
		}
		error = '';
		currentStep = 'confirm';
	}

	async function handlePair() {
		if (!scannedToken) {
			error = 'No pairing token found';
			return;
		}

		loading = true;
		error = '';

		try {
			pairedDevice = await pairDevice(scannedToken, selectedProfileIds);
			if (deviceName && deviceName !== 'New Tablet') {
				// Update device name if changed
				const { updateDevice } = await import('$lib/api');
				await updateDevice(pairedDevice.id, { name: deviceName });
				pairedDevice = { ...pairedDevice, name: deviceName };
			}
			currentStep = 'success';

			// Auto-redirect after 2 seconds
			setTimeout(() => {
				goto('/devices');
			}, 2000);
		} catch (err: unknown) {
			const apiErr = err as { status?: number; message?: string };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			// Backend returns 'Invalid or expired pairing token' for both cases
			if (apiErr?.status === 400 && apiErr?.message?.includes('Invalid or expired')) {
				error = 'QR code expired or invalid. Ask them to refresh the tablet screen.';
			} else {
				error = getErrorMessage(err, 'pair device');
			}
		} finally {
			loading = false;
		}
	}

	function goBack() {
		if (currentStep === 'profiles') {
			currentStep = 'scan';
			scannedToken = '';
		} else if (currentStep === 'confirm') {
			currentStep = 'profiles';
		}
	}

	function getSelectedProfileNames(): string {
		return profiles
			.filter((p) => selectedProfileIds.includes(p.id))
			.map((p) => p.name)
			.join(', ');
	}
</script>

<div class="max-w-md mx-auto px-unit-3 py-unit-3">
	<!-- Header -->
	<div class="flex items-center gap-3 mb-unit-4">
		{#if currentStep !== 'success'}
			<button
				type="button"
				onclick={() => (currentStep === 'scan' ? goto('/devices') : goBack())}
				class="p-1 -ml-1 text-text-secondary hover:text-text-primary transition-colors"
				aria-label="Go back"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
				>
					<path
						fill-rule="evenodd"
						d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		{/if}
		<h2 class="text-h2 font-semibold text-text-primary">Pair Tablet</h2>
	</div>

	<!-- Step Indicator -->
	{#if currentStep !== 'success'}
		<div class="flex items-center justify-center gap-2 mb-unit-4">
			{#each ['scan', 'profiles', 'confirm'] as step, i}
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
						{currentStep === step
						? 'bg-primary text-white'
						: ['scan', 'profiles', 'confirm'].indexOf(currentStep) > i
							? 'bg-green-500 text-white'
							: 'bg-gray-200 text-text-secondary'}"
				>
					{#if ['scan', 'profiles', 'confirm'].indexOf(currentStep) > i}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-4 h-4"
						>
							<path
								fill-rule="evenodd"
								d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
								clip-rule="evenodd"
							/>
						</svg>
					{:else}
						{i + 1}
					{/if}
				</div>
				{#if i < 2}
					<div
						class="w-8 h-0.5 {['scan', 'profiles', 'confirm'].indexOf(currentStep) > i
							? 'bg-green-500'
							: 'bg-gray-200'}"
					></div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Step Content -->
	{#if currentStep === 'scan'}
		<div class="card">
			<h3 class="text-lg font-semibold text-text-primary mb-unit-2 text-center">Scan QR Code</h3>
			<p class="text-text-secondary text-sm mb-unit-3 text-center">
				Open the pairing screen on the tablet and scan the QR code
			</p>
			<QRScanner onScan={handleScan} onError={handleScanError} />
			{#if error}
				<p class="text-danger text-sm mt-unit-2 text-center">{error}</p>
			{/if}
		</div>
	{:else if currentStep === 'profiles'}
		<div class="card">
			<h3 class="text-lg font-semibold text-text-primary mb-unit-2">Select Profiles</h3>
			<p class="text-text-secondary text-sm mb-unit-3">
				Choose which care profiles should be accessible on this tablet
			</p>

			{#if profiles.length === 0}
				<p class="text-text-secondary text-center py-unit-3">
					No profiles found. Create a profile first.
				</p>
			{:else}
				<ProfileSelector
					{profiles}
					selectedIds={selectedProfileIds}
					onSelectionChange={handleProfileSelectionChange}
				/>
			{/if}

			{#if error}
				<p class="text-danger text-sm mt-unit-2">{error}</p>
			{/if}

			<button
				type="button"
				onclick={goToConfirm}
				disabled={selectedProfileIds.length === 0 || profiles.length === 0}
				class="w-full mt-unit-3 bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base
					hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				Continue
			</button>
		</div>
	{:else if currentStep === 'confirm'}
		<div class="card">
			<h3 class="text-lg font-semibold text-text-primary mb-unit-3 text-center">Ready to pair!</h3>

			<!-- Device Name -->
			<div class="mb-unit-3">
				<label for="device-name" class="block text-sm font-medium text-text-primary mb-1">
					Device Name
				</label>
				<input
					id="device-name"
					type="text"
					bind:value={deviceName}
					placeholder="e.g., Living Room Tablet"
					class="w-full px-3 py-2 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
				/>
			</div>

			<!-- Selected Profiles Summary -->
			<div class="mb-unit-3 p-3 bg-gray-50 rounded-card">
				<p class="text-sm text-text-secondary mb-1">Selected Profiles:</p>
				<p class="font-medium text-text-primary">{getSelectedProfileNames()}</p>
			</div>

			{#if error}
				<p class="text-danger text-sm mb-unit-2">{error}</p>
			{/if}

			<button
				type="button"
				onclick={handlePair}
				disabled={loading}
				class="w-full bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base
					hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Pairing…' : 'Pair Device'}
			</button>
		</div>
	{:else if currentStep === 'success'}
		<div class="card text-center py-unit-4">
			<!-- Success checkmark animation -->
			<div
				class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-unit-3"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-10 h-10 text-green-500"
				>
					<path
						fill-rule="evenodd"
						d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>

			<h3 class="text-lg font-semibold text-text-primary mb-unit-2">Device paired successfully!</h3>
			<p class="text-text-secondary mb-unit-3">
				{pairedDevice?.name ?? 'Your tablet'} is now connected and ready to use.
			</p>

			<a
				href="/devices"
				class="inline-block bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base hover:bg-blue-600 transition-colors"
			>
				Go to Devices
			</a>
		</div>
	{/if}
</div>
