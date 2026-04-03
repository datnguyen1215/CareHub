<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Device } from '$lib/api';
	import DeviceStatusDot from '$lib/components/devices/DeviceStatusDot.svelte';
	import BatteryIndicator from '$lib/components/devices/BatteryIndicator.svelte';

	interface Props {
		device: Device;
		onSendPhoto?: (device: Device) => void;
		onCall?: (device: Device) => void;
	}

	let { device, onSendPhoto, onCall }: Props = $props();

	const isOnline = $derived(device.status === 'online');

	function getRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return 'Yesterday';
		return `${diffDays}d ago`;
	}

	function getInitial(name: string): string {
		return name.charAt(0).toUpperCase();
	}

	function handleSettings() {
		goto(`/devices/${device.id}`);
	}
</script>

<div class="card">
	<!-- Header: Name and Status -->
	<div class="flex items-start justify-between mb-unit-2">
		<div class="flex items-center gap-2">
			<DeviceStatusDot status={device.status} />
			<h3 class="text-h3 font-semibold text-text-primary">{device.name}</h3>
		</div>
		<span class="text-xs text-text-secondary capitalize">{device.status}</span>
	</div>

	<!-- Assigned Profiles -->
	{#if device.profiles.length > 0}
		<div class="flex items-center gap-1 mb-unit-2">
			<div class="flex -space-x-2">
				{#each device.profiles.slice(0, 4) as profile (profile.id)}
					<div
						class="w-6 h-6 rounded-full bg-primary/10 border-2 border-white flex items-center justify-center overflow-hidden"
						title={profile.name}
					>
						{#if profile.avatar_url}
							<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
						{:else}
							<span class="text-primary font-semibold text-xs">
								{getInitial(profile.name)}
							</span>
						{/if}
					</div>
				{/each}
				{#if device.profiles.length > 4}
					<div
						class="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
					>
						<span class="text-xs text-text-secondary">+{device.profiles.length - 4}</span>
					</div>
				{/if}
			</div>
			<span class="text-xs text-text-secondary ml-1">
				{device.profiles.length} profile{device.profiles.length !== 1 ? 's' : ''}
			</span>
		</div>
	{:else}
		<p class="text-xs text-text-secondary mb-unit-2">No profiles assigned</p>
	{/if}

	<!-- Status Row: Battery and Last Active -->
	<div class="flex items-center justify-between text-xs text-text-secondary mb-unit-3">
		<BatteryIndicator level={device.battery_level} />
		<span>Last active: {getRelativeTime(device.last_seen_at)}</span>
	</div>

	<!-- Action Buttons -->
	<div class="flex gap-2">
		<button
			type="button"
			onclick={() => onSendPhoto?.(device)}
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
			onclick={() => onCall?.(device)}
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
			onclick={handleSettings}
			class="px-2 py-1.5 text-sm rounded-card border border-gray-300 text-text-primary hover:bg-gray-50 transition-colors"
			title="Device settings"
		>
			⚙️
		</button>
	</div>
</div>
