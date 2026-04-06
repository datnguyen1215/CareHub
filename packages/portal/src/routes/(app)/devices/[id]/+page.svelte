<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		getDevice,
		updateDevice,
		unpairDevice,
		listProfiles,
		assignProfilesToDevice,
		removeProfileFromDevice,
		getLatestRelease,
		triggerDeviceUpdate,
		type Device,
		type CareProfile,
		type Release
	} from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/utils/error-utils';
	import DeviceStatusDot from '$lib/components/devices/DeviceStatusDot.svelte';
	import BatteryIndicator from '$lib/components/devices/BatteryIndicator.svelte';
	import CallModal from '$lib/components/call/CallModal.svelte';
	import { getInitial } from '$lib/utils/format';
	import {
		callState,
		initiateCall,
		endCall,
		toggleMute,
		toggleVideo
	} from '$lib/stores/call.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { seedDeviceStatus, getDeviceStatus } from '$lib/stores/deviceStatus.svelte';
	import * as websocket from '$lib/services/websocket';

	let device = $state<Device | null>(null);
	let allProfiles = $state<CareProfile[]>([]);
	let loadError = $state('');
	let loading = $state(true);
	let canRetry = $state(false);

	let isEditingName = $state(false);
	let editedName = $state('');
	let savingName = $state(false);
	let saveNameError = $state('');

	let showUnpairModal = $state(false);
	let unpairLoading = $state(false);
	let unpairError = $state('');

	let showAddProfileModal = $state(false);
	let addingProfile = $state(false);
	let addProfileError = $state('');
	let removeProfileError = $state('');

	// Software update state
	let latestRelease = $state<Release | null>(null);
	let showUpdateConfirm = $state(false);
	let updateLoading = $state(false);
	/**
	 * Update progress state received via WebSocket device_status_changed messages.
	 * phase: null = idle, 'downloading' = in progress, 'complete' = done, 'failed' = error
	 */
	let updatePhase = $state<'downloading' | 'complete' | 'failed' | null>(null);
	let updateProgress = $state(0); // 0–100 during download
	let unsubscribeWs: (() => void) | null = null;

	const deviceId = $derived(page.params.id ?? '');

	async function loadData() {
		loading = true;
		loadError = '';
		canRetry = false;

		if (!deviceId) {
			goto('/devices');
			return;
		}

		try {
			const [deviceData, profilesData, releaseData] = await Promise.all([
				getDevice(deviceId),
				listProfiles(),
				getLatestRelease('kiosk').catch(() => undefined)
			]);
			device = deviceData;
			allProfiles = profilesData;
			editedName = deviceData.name;
			seedDeviceStatus(deviceData);
			latestRelease = releaseData ?? null;
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			if (apiErr?.status === 404) {
				goto('/devices');
				return;
			}
			loadError = getErrorMessage(err, 'load device');
			canRetry = isRetryable(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();

		/**
		 * Listen for device_status_changed WebSocket messages that carry OTA update progress.
		 * Expected message shape: { type: 'device_status_changed', deviceId, updateStatus, updateProgress }
		 * updateStatus: 'downloading' | 'complete' | 'failed'
		 * updateProgress: number (0–100, present when status is 'downloading')
		 *
		 * Note: device_status_changed is not in SignalingMessage — it's added by the OTA backend
		 * (commit 5818216f). Cast to any until shared types are updated.
		 */
		unsubscribeWs = websocket.onMessage((message) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const msg = message as any;
			if (msg.type !== 'device_status_changed') return;
			if (msg.deviceId !== deviceId) return;

			if (msg.updateStatus === 'downloading') {
				updatePhase = 'downloading';
				updateProgress = typeof msg.updateProgress === 'number' ? msg.updateProgress : 0;
			} else if (msg.updateStatus === 'complete') {
				updatePhase = 'complete';
				updateProgress = 100;
				toast.success('Kiosk updated successfully.');
				// Reload device to get updated app_version
				loadData();
			} else if (msg.updateStatus === 'failed') {
				updatePhase = 'failed';
				toast.error('Kiosk update failed. Please try again.');
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeWs) unsubscribeWs();
	});

	function getRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minutes ago`;
		if (diffHours < 24) return `${diffHours} hours ago`;
		if (diffDays === 1) return 'Yesterday';
		return `${diffDays} days ago`;
	}

	function startEditName() {
		editedName = device?.name ?? '';
		isEditingName = true;
	}

	async function saveName() {
		if (!device || !editedName.trim()) return;
		if (editedName.trim() === device.name) {
			isEditingName = false;
			return;
		}

		savingName = true;
		saveNameError = '';
		try {
			const updated = await updateDevice(device.id, { name: editedName.trim() });
			// PATCH returns only device fields without profiles, so preserve existing profiles
			device = { ...device, name: updated.name };
			isEditingName = false;
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			saveNameError = getErrorMessage(err, 'save name');
		} finally {
			savingName = false;
		}
	}

	function cancelEditName() {
		editedName = device?.name ?? '';
		isEditingName = false;
	}

	function openUnpairModal() {
		showUnpairModal = true;
		unpairError = '';
	}

	function closeUnpairModal() {
		showUnpairModal = false;
		unpairError = '';
	}

	async function handleUnpair() {
		if (!device) return;

		unpairLoading = true;
		unpairError = '';

		try {
			await unpairDevice(device.id);
			goto('/devices');
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			unpairError = getErrorMessage(err, 'unpair device');
		} finally {
			unpairLoading = false;
		}
	}

	async function handleRemoveProfile(profileId: string) {
		if (!device) return;

		removeProfileError = '';
		try {
			await removeProfileFromDevice(device.id, profileId);
			device = {
				...device,
				profiles: device.profiles.filter((p) => p.id !== profileId)
			};
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			removeProfileError = getErrorMessage(err, 'remove profile');
		}
	}

	function getUnassignedProfiles(): CareProfile[] {
		if (!device) return allProfiles;
		const assignedIds = new Set(device.profiles.map((p) => p.id));
		return allProfiles.filter((p) => !assignedIds.has(p.id));
	}

	async function handleAddProfile(profileId: string) {
		if (!device) return;

		addingProfile = true;
		addProfileError = '';
		try {
			const result = await assignProfilesToDevice(device.id, [profileId]);
			device = { ...device, profiles: result.profiles };
			showAddProfileModal = false;
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			addProfileError = getErrorMessage(err, 'add profile');
		} finally {
			addingProfile = false;
		}
	}


	function handleCall() {
		if (!device || liveStatus !== 'online') {
			toast.warning('Device is offline. Cannot place call.');
			return;
		}
		initiateCall(device.id, device.name);
	}

	function handleRetryCall() {
		if (!device || liveStatus !== 'online') {
			toast.warning('Device is offline. Cannot place call.');
			return;
		}
		initiateCall(device.id, device.name);
	}

	// Derived state for call button
	const isCallInProgress = $derived(callState.status !== 'idle' && callState.status !== 'ended');
	const showCallModal = $derived(callState.status !== 'idle');

	/** Live device status from store — updates reactively on WebSocket events */
	const liveStatus = $derived(device ? getDeviceStatus(device.id, device.status) : 'offline');

	/**
	 * True when device is online, a release exists, device version is known, and differs from latest.
	 * The update button is only enabled in this state.
	 */
	const canUpdate = $derived(
		device !== null &&
			liveStatus === 'online' &&
			latestRelease !== null &&
			device.app_version !== null &&
			device.app_version !== undefined &&
			device.app_version !== latestRelease.version &&
			updatePhase !== 'downloading'
	);

	async function handleTriggerUpdate() {
		if (!device || !latestRelease) return;
		showUpdateConfirm = false;
		updateLoading = true;
		updatePhase = 'downloading';
		updateProgress = 0;
		try {
			await triggerDeviceUpdate(device.id, latestRelease.id);
		} catch (err: unknown) {
			updatePhase = 'failed';
			toast.error(getErrorMessage(err, 'trigger update'));
		} finally {
			updateLoading = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto px-unit-3 py-unit-3">
	<!-- Header -->
	<div class="flex items-center gap-3 mb-unit-4">
		<a
			href="/devices"
			class="p-1 -ml-1 text-text-secondary hover:text-text-primary transition-colors"
			aria-label="Back to devices"
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
		</a>

		{#if device}
			{#if isEditingName}
				<div class="flex items-center gap-2 flex-1">
					<input
						type="text"
						bind:value={editedName}
						class="text-h2 font-semibold px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent flex-1"
						onkeydown={(e) => {
							if (e.key === 'Enter') saveName();
							if (e.key === 'Escape') cancelEditName();
						}}
					/>
					<button
						type="button"
						onclick={saveName}
						disabled={savingName}
						class="p-1 text-green-600 hover:text-green-700"
						aria-label="Save name"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-5 h-5"
						>
							<path
								fill-rule="evenodd"
								d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
					<button
						type="button"
						onclick={cancelEditName}
						class="p-1 text-text-secondary hover:text-text-primary"
						aria-label="Cancel"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-5 h-5"
						>
							<path
								fill-rule="evenodd"
								d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			{:else}
				<h2 class="text-h2 font-semibold text-text-primary flex-1">{device.name}</h2>
				<button
					type="button"
					onclick={startEditName}
					class="p-1 text-text-secondary hover:text-text-primary transition-colors"
					aria-label="Edit device name"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-5 h-5"
					>
						<path
							d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z"
						/>
					</svg>
				</button>
			{/if}
		{:else}
			<h2 class="text-h2 font-semibold text-text-primary">Device</h2>
		{/if}
	</div>

	{#if saveNameError}
		<p class="text-danger text-sm mb-unit-2" role="alert">{saveNameError}</p>
	{/if}

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
	{:else if device}
		<!-- Status Section -->
		<div class="card mb-unit-3">
			<h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-unit-2">
				Status
			</h3>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-text-secondary">Status</span>
					<div class="flex items-center gap-2">
						<DeviceStatusDot status={liveStatus} />
						<span class="capitalize text-text-primary">{liveStatus}</span>
					</div>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-text-secondary">Battery</span>
					<BatteryIndicator level={device.battery_level} />
				</div>
				<div class="flex items-center justify-between">
					<span class="text-text-secondary">Last active</span>
					<span class="text-text-primary">{getRelativeTime(device.last_seen_at)}</span>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="card mb-unit-3">
			<h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-unit-2">
				Actions
			</h3>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={handleCall}
					disabled={liveStatus !== 'online' || isCallInProgress}
					class="flex-1 px-3 py-2 rounded-card border border-gray-300 font-medium
						{liveStatus === 'online' && !isCallInProgress
						? 'text-text-primary hover:bg-gray-50'
						: 'text-gray-400 cursor-not-allowed'} transition-colors"
				>
					{#if callState.status === 'initiating' || callState.status === 'ringing'}
						Calling...
					{:else}
						📞 Call
					{/if}
				</button>
			</div>
		</div>

		<!-- Assigned Profiles Section -->
		<div class="card mb-unit-3">
			<div class="flex items-center justify-between mb-unit-2">
				<h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">
					Assigned Profiles
				</h3>
				{#if getUnassignedProfiles().length > 0}
					<button
						type="button"
						onclick={() => (showAddProfileModal = true)}
						class="text-primary text-sm font-semibold hover:underline"
					>
						+ Add
					</button>
				{/if}
			</div>

			{#if removeProfileError}
				<p class="text-danger text-sm mb-unit-2" role="alert">{removeProfileError}</p>
			{/if}

			{#if device.profiles.length === 0}
				<p class="text-text-secondary text-sm">No profiles assigned to this device.</p>
			{:else}
				<div class="grid grid-cols-2 gap-2">
					{#each device.profiles as profile (profile.id)}
						<div class="relative flex items-center gap-2 p-2 bg-gray-50 rounded-card group">
							<!-- Avatar -->
							<div
								class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden"
							>
								{#if profile.avatar_url}
									<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
								{:else}
									<span class="text-primary font-semibold text-xs">
										{getInitial(profile.name)}
									</span>
								{/if}
							</div>
							<span class="text-sm text-text-primary truncate flex-1">{profile.name}</span>
							<!-- Remove button -->
							<button
								type="button"
								onclick={() => handleRemoveProfile(profile.id)}
								class="absolute -top-1 -right-1 w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center
									opacity-0 group-hover:opacity-100 hover:bg-danger hover:text-white transition-all"
								aria-label={`Remove ${profile.name}`}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="w-3 h-3"
								>
									<path
										fill-rule="evenodd"
										d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Software Update Section -->
		<div class="card mb-unit-3">
			<h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-unit-2">
				Software Update
			</h3>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-text-secondary">Current version</span>
					<span class="text-text-primary font-mono text-sm">
						{device.app_version ?? 'Unknown'}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-text-secondary">Latest available</span>
					<span class="text-text-primary font-mono text-sm">
						{latestRelease ? latestRelease.version : 'No releases yet'}
					</span>
				</div>
				{#if latestRelease?.notes}
					<div class="pt-1">
						<p class="text-xs text-text-secondary mb-1">Release notes</p>
						<p class="text-sm text-text-primary whitespace-pre-line">{latestRelease.notes}</p>
					</div>
				{/if}
			</div>

			<!-- Update progress bar shown during download -->
			{#if updatePhase === 'downloading'}
				<div class="mt-unit-2">
					<div class="flex items-center justify-between text-xs text-text-secondary mb-1">
						<span>Downloading update…</span>
						<span>{updateProgress}%</span>
					</div>
					<div class="w-full bg-gray-200 rounded-full h-2">
						<div
							class="bg-primary h-2 rounded-full transition-all duration-300"
							style="width: {updateProgress}%"
						></div>
					</div>
				</div>
			{/if}

			<button
				type="button"
				onclick={() => (showUpdateConfirm = true)}
				disabled={!canUpdate || updateLoading}
				class="mt-unit-3 w-full px-unit-3 py-2 rounded-card font-semibold text-sm transition-colors
					{canUpdate && !updateLoading
					? 'bg-primary text-white hover:bg-blue-600'
					: 'bg-gray-100 text-gray-400 cursor-not-allowed'}"
			>
				{#if updatePhase === 'downloading'}
					Updating…
				{:else if latestRelease}
					Update to v{latestRelease.version}
				{:else}
					No update available
				{/if}
			</button>

			{#if !canUpdate && liveStatus !== 'online' && latestRelease && device.app_version !== latestRelease.version}
				<p class="text-xs text-text-secondary mt-1 text-center">Device must be online to update</p>
			{/if}
		</div>

		<!-- Danger Zone -->
		<div class="card border-danger/30">
			<h3 class="text-sm font-semibold text-danger uppercase tracking-wider mb-unit-2">
				Danger Zone
			</h3>
			<p class="text-text-secondary text-sm mb-unit-2">
				Unpairing this device will disconnect it from your account. The tablet will return to the
				pairing screen.
			</p>
			<button
				type="button"
				onclick={openUnpairModal}
				class="px-unit-3 py-2 rounded-card bg-danger text-white font-semibold text-sm hover:opacity-90 transition-opacity"
			>
				Unpair Device
			</button>
		</div>
	{/if}
</div>

<!-- Update Confirmation Modal -->
{#if showUpdateConfirm && device && latestRelease}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
		role="dialog"
		aria-modal="true"
		aria-labelledby="update-modal-title"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) showUpdateConfirm = false;
		}}
	>
		<div class="card w-full max-w-sm">
			<h2 id="update-modal-title" class="text-h3 font-semibold text-text-primary mb-unit-2">
				Update kiosk
			</h2>
			<p class="text-base text-text-secondary mb-unit-3">
				Update <strong class="text-text-primary">{device.name}</strong> to
				<strong class="text-text-primary">v{latestRelease.version}</strong>? The kiosk will
				restart after the update completes.
			</p>
			<div class="flex gap-unit-2 justify-end">
				<button
					type="button"
					onclick={() => (showUpdateConfirm = false)}
					class="px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleTriggerUpdate}
					class="px-unit-3 py-2 rounded-card bg-primary text-white font-semibold text-base hover:bg-blue-600 transition-colors"
				>
					Update to v{latestRelease.version}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Unpair Confirmation Modal -->
{#if showUnpairModal && device}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		aria-labelledby="unpair-modal-title"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) closeUnpairModal();
		}}
	>
		<div class="card w-full max-w-sm">
			<h2 id="unpair-modal-title" class="text-h3 font-semibold text-text-primary mb-unit-2">
				Unpair device
			</h2>
			<p class="text-base text-text-secondary mb-unit-3">
				Are you sure you want to unpair <strong class="text-text-primary">{device.name}</strong>?
				The tablet will return to the pairing screen.
			</p>

			{#if unpairError}
				<p class="text-sm text-danger mb-unit-2" role="alert">{unpairError}</p>
			{/if}

			<div class="flex gap-unit-2 justify-end">
				<button
					type="button"
					onclick={closeUnpairModal}
					disabled={unpairLoading}
					class="px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary
						hover:bg-gray-50 disabled:opacity-50 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleUnpair}
					disabled={unpairLoading}
					class="px-unit-3 py-2 rounded-card bg-danger text-white font-semibold text-base
						hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
				>
					{unpairLoading ? 'Unpairing…' : 'Unpair'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Add Profile Modal -->
{#if showAddProfileModal && device}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		aria-labelledby="add-profile-modal-title"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) showAddProfileModal = false;
		}}
	>
		<div class="card w-full max-w-sm max-h-[80vh] overflow-y-auto">
			<h2 id="add-profile-modal-title" class="text-h3 font-semibold text-text-primary mb-unit-3">
				Add Profile
			</h2>

			{#if addProfileError}
				<p class="text-danger text-sm mb-unit-2" role="alert">{addProfileError}</p>
			{/if}

			{#if getUnassignedProfiles().length === 0}
				<p class="text-text-secondary">All profiles are already assigned to this device.</p>
			{:else}
				<div class="space-y-2">
					{#each getUnassignedProfiles() as profile (profile.id)}
						<button
							type="button"
							onclick={() => handleAddProfile(profile.id)}
							disabled={addingProfile}
							class="w-full flex items-center gap-3 p-3 rounded-card border border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
						>
							<div
								class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden"
							>
								{#if profile.avatar_url}
									<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
								{:else}
									<span class="text-primary font-semibold text-sm">
										{getInitial(profile.name)}
									</span>
								{/if}
							</div>
							<div class="text-left flex-1 min-w-0">
								<p class="font-semibold text-text-primary truncate">{profile.name}</p>
								{#if profile.relationship}
									<p class="text-sm text-text-secondary capitalize">{profile.relationship}</p>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}

			<button
				type="button"
				onclick={() => (showAddProfileModal = false)}
				class="w-full mt-unit-3 px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary hover:bg-gray-50 transition-colors"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}

<!-- Call Modal -->
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
		onEndCall={endCall}
		onRetry={handleRetryCall}
	/>
{/if}
