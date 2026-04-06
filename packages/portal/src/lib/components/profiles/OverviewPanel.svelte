<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		updateProfile,
		deleteProfile,
		listMedications,
		listEvents,
		uploadFile,
		listDevices,
		type CareProfile,
		type Medication,
		type Event as ApiEvent,
		type Device
	} from '$lib/api';
	import DeviceStatusDot from '$lib/components/devices/DeviceStatusDot.svelte';
	import BatteryIndicator from '$lib/components/devices/BatteryIndicator.svelte';
	import { getErrorMessage } from '$lib/utils/error-utils';
	import { seedDeviceStatuses, getDeviceStatus } from '$lib/stores/deviceStatus.svelte';
	import { formatDateLong, formatDateShort, getInitial } from '$lib/utils/format';
	import { toast } from '$lib/stores/toast.svelte';
	import {
		callState,
		initiateCall,
		endCall,
		toggleMute,
		toggleVideo
	} from '$lib/stores/call.svelte';
	import CallModal from '$lib/components/call/CallModal.svelte';
	import DeleteConfirmModal from '$lib/components/shared/DeleteConfirmModal.svelte';

	interface Props {
		profileId: string;
		profile: CareProfile | null;
		onProfileUpdate?: (profile: CareProfile) => void;
	}

	let { profileId, profile, onProfileUpdate }: Props = $props();

	let recentMeds = $state<Medication[]>([]);
	let upcomingEvents = $state<ApiEvent[]>([]);
	let profileDevices = $state<Device[]>([]);
	let loading = $state(false);

	// Avatar upload state
	let avatarUploading = $state(false);
	let avatarError = $state('');
	let avatarFileInput = $state<HTMLInputElement | undefined>(undefined);

	// Delete state
	let showDeleteProfileModal = $state(false);

	// Call modal state
	const showCallModal = $derived(callState.status !== 'idle');

	async function loadData() {
		if (!profile) return;
		loading = true;

		try {
			const [medsData, eventsData] = await Promise.all([
				listMedications(profileId),
				listEvents(profileId)
			]);
			recentMeds = medsData.filter((m) => m.status === 'active').slice(0, 3);

			// Filter upcoming events (future dates only)
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			upcomingEvents = eventsData
				.filter((e) => new Date(e.event_date) >= now)
				.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
				.slice(0, 3);

			// Fetch devices separately - non-blocking
			try {
				const devicesData = await listDevices();
				profileDevices = devicesData.filter((d) => d.profiles.some((p) => p.id === profileId));
				seedDeviceStatuses(devicesData);
			} catch {
				profileDevices = [];
			}
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			console.error('Failed to load overview data', err);
		} finally {
			loading = false;
		}
	}

	// Load supplementary data once when profileId is available
	let hasLoadedData = $state(false);
	$effect(() => {
		if (profileId && !hasLoadedData) {
			loadData();
			hasLoadedData = true;
		}
	});

	function handleAvatarClick() {
		if (!avatarUploading) {
			avatarError = '';
			avatarFileInput?.click();
		}
	}

	async function handleAvatarChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !profile) return;

		avatarError = '';

		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			avatarError = 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.';
			input.value = '';
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			avatarError = 'File too large. Maximum size is 5MB.';
			input.value = '';
			return;
		}

		avatarUploading = true;
		try {
			const url = await uploadFile(file);
			const updated = await updateProfile(profile.id, { avatar_url: url });
			onProfileUpdate?.(updated);
			toast.success('Photo updated');
		} catch (err: unknown) {
			avatarError = getErrorMessage(err, 'upload photo');
		} finally {
			avatarUploading = false;
			input.value = '';
		}
	}

	function openDeleteProfileModal() {
		showDeleteProfileModal = true;
	}

	function closeDeleteProfileModal() {
		showDeleteProfileModal = false;
	}

	async function handleDeleteProfileConfirm() {
		if (!profile) return;
		await deleteProfile(profile.id);
		toast.destructive('Profile deleted');
		goto('/profiles');
	}

	function handleSendPhoto(device: Device) {
		// TODO: Implement send photo functionality
		toast.success(`Opening photo picker for ${device.name}...`);
	}

	function handleCall(device: Device) {
		initiateCall(device.id, device.name);
	}

	function handleRetryCall() {
		if (callState.targetDeviceId && callState.targetDeviceName) {
			initiateCall(callState.targetDeviceId, callState.targetDeviceName);
		}
	}

	function handleDeviceSettings(deviceId: string) {
		goto(`/devices/${deviceId}`);
	}
</script>

{#if profile}
	<!-- Avatar Header -->
	<div class="flex flex-col items-center mb-unit-3">
		<button
			onclick={handleAvatarClick}
			disabled={avatarUploading}
			class="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden
			       hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
			       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
			aria-label="Change profile photo"
		>
			{#if profile.avatar_url}
				<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
			{:else}
				<span class="text-primary font-semibold text-3xl">{getInitial(profile.name)}</span>
			{/if}

			<!-- Camera overlay -->
			<div
				class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0
				       hover:opacity-100 transition-opacity"
				class:opacity-100={avatarUploading}
			>
				{#if avatarUploading}
					<svg
						class="animate-spin text-white w-6 h-6"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="text-white w-6 h-6"
					>
						<path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
						<path
							fill-rule="evenodd"
							d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3H4.5a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.152-.177a1.56 1.56 0 0 0 1.11-.71l.821-1.317a2.685 2.685 0 0 1 2.332-1.39ZM12 12.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</div>
		</button>
		{#if avatarError}
			<p class="text-danger text-sm mt-unit-1 text-center">{avatarError}</p>
		{/if}
		<h2 class="text-h2 font-semibold text-text-primary mt-unit-2">{profile.name}</h2>
		{#if profile.relationship}
			<p class="text-text-secondary capitalize">{profile.relationship}</p>
		{/if}
	</div>

	<input
		bind:this={avatarFileInput}
		type="file"
		accept="image/jpeg,image/png,image/gif,image/webp"
		class="hidden"
		onchange={handleAvatarChange}
	/>

	{#if loading}
		<!-- Skeleton for supplementary data only -->
		<div class="animate-pulse space-y-unit-2" aria-label="Loading overview">
			<div class="card mb-unit-2 space-y-2">
				<div class="h-4 bg-gray-200 rounded w-2/3"></div>
				<div class="h-3 bg-gray-200 rounded w-1/2"></div>
			</div>
			<div class="card mb-unit-2 space-y-2">
				<div class="h-4 bg-gray-200 rounded w-1/2"></div>
				<div class="h-3 bg-gray-200 rounded w-2/3"></div>
			</div>
			<div class="card space-y-2">
				<div class="h-4 bg-gray-200 rounded w-1/3"></div>
				<div class="h-3 bg-gray-200 rounded w-1/2"></div>
			</div>
		</div>
	{:else}
	<!-- Device card(s) -->
	{#if profileDevices.length > 0}
		{#each profileDevices as device (device.id)}
			{@const liveStatus = getDeviceStatus(device.id, device.status)}
			{@const isOnline = liveStatus === 'online'}
			<div class="card mb-unit-2">
				<div class="flex items-center justify-between mb-unit-2">
					<div class="flex items-center gap-2">
						<span class="text-base">📱</span>
						<h3 class="text-base font-semibold text-text-primary">{device.name}</h3>
					</div>
					<div class="flex items-center gap-1.5">
						<DeviceStatusDot status={liveStatus} size="sm" />
						<span class="text-xs text-text-secondary capitalize">{liveStatus}</span>
					</div>
				</div>

				{#if device.battery_level !== null}
					<div class="mb-unit-2">
						<BatteryIndicator level={device.battery_level} />
					</div>
				{/if}

				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => handleSendPhoto(device)}
						disabled={!isOnline}
						class="flex-1 px-2 py-1.5 text-sm rounded-card border border-gray-300
							{isOnline
							? 'text-text-primary hover:bg-gray-50'
							: 'text-gray-400 cursor-not-allowed'} transition-colors"
						title={!isOnline ? 'Device is offline' : 'Send a photo to this device'}
					>
						📷 Send Photo
					</button>
					<button
						type="button"
						onclick={() => handleCall(device)}
						disabled={!isOnline}
						class="flex-1 px-2 py-1.5 text-sm rounded-card border border-gray-300
							{isOnline
							? 'text-text-primary hover:bg-gray-50'
							: 'text-gray-400 cursor-not-allowed'} transition-colors"
						title={!isOnline ? 'Device is offline' : 'Call this device'}
					>
						📞 Call
					</button>
					<button
						type="button"
						onclick={() => handleDeviceSettings(device.id)}
						class="px-2 py-1.5 text-sm rounded-card border border-gray-300 text-text-primary hover:bg-gray-50 transition-colors"
						title="Device settings"
					>
						⚙️
					</button>
				</div>
			</div>
		{/each}
	{:else}
		<div class="card mb-unit-2 text-center py-unit-2">
			<p class="text-text-secondary text-sm mb-unit-1">No device linked</p>
			<button onclick={() => goto('/devices/pair')} class="text-sm text-primary hover:underline">
				+ Link Device
			</button>
		</div>
	{/if}

	<!-- Profile info card -->
	{#if profile.date_of_birth || (profile.conditions && profile.conditions.length > 0)}
		<div class="card mb-unit-2">
			{#if profile.date_of_birth}
				<dl class="flex flex-col gap-1.5 text-sm">
					<div class="flex gap-2">
						<dt class="text-text-secondary w-28 shrink-0">Date of birth</dt>
						<dd class="text-text-primary">{formatDateLong(profile.date_of_birth)}</dd>
					</div>
				</dl>
			{/if}

			{#if profile.conditions && profile.conditions.length > 0}
				<div class="flex flex-wrap gap-1.5" class:mt-unit-2={profile.date_of_birth}>
					{#each profile.conditions as condition}
						<span
							class="text-xs bg-blue-50 text-primary rounded-full px-2.5 py-0.5 border border-blue-100"
						>
							{condition}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Recent medications card -->
	<div class="card mb-unit-2">
		<div class="flex items-center justify-between mb-unit-2">
			<h3 class="text-base font-semibold text-text-primary">Recent Medications</h3>
		</div>

		{#if recentMeds.length === 0}
			<p class="text-text-secondary text-sm">No medications added yet</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each recentMeds as med (med.id)}
					<li class="flex items-center gap-2 text-sm">
						<span class="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden="true"></span>
						<span class="text-text-primary font-medium">{med.name}</span>
						{#if med.dosage}
							<span class="text-text-secondary">{med.dosage}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Upcoming events card -->
	<div class="card">
		<div class="flex items-center justify-between mb-unit-2">
			<h3 class="text-base font-semibold text-text-primary">Upcoming</h3>
		</div>

		{#if upcomingEvents.length === 0}
			<p class="text-text-secondary text-sm">No upcoming events</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each upcomingEvents as event (event.id)}
					<li class="flex items-center gap-2 text-sm">
						<span class="text-text-secondary shrink-0">{formatDateShort(event.event_date)}</span>
						<span class="text-text-primary font-medium truncate">{event.title}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{/if}
	<!-- end supplementary content -->

	<!-- Delete Profile button -->
	<div class="mt-unit-4 pt-unit-3 border-t border-gray-200">
		<button
			onclick={openDeleteProfileModal}
			class="w-full py-3 rounded-card border border-danger text-danger font-semibold text-base
			       hover:bg-danger hover:text-white transition-colors"
		>
			Delete Profile
		</button>
	</div>
{/if}

{#if showDeleteProfileModal && profile}
	<DeleteConfirmModal
		name={profile.name}
		onConfirm={handleDeleteProfileConfirm}
		onClose={closeDeleteProfileModal}
	/>
{/if}

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
