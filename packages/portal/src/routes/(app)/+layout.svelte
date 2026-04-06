<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '$lib/components/navigation/TopBar.svelte';
	import BottomNav from '$lib/components/navigation/BottomNav.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { Snippet } from 'svelte';
	import * as websocket from '$lib/services/websocket';
	import { initializeCallHandlers } from '$lib/stores/call.svelte';
	import { initializeDeviceStatusHandlers } from '$lib/stores/deviceStatus.svelte';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// Connect WebSocket for real-time signaling
		websocket.connect();

		// Initialize call state handlers
		const cleanupCallHandlers = initializeCallHandlers();

		// Initialize device status handlers (real-time status updates)
		const cleanupDeviceStatusHandlers = initializeDeviceStatusHandlers();

		return () => {
			cleanupCallHandlers();
			cleanupDeviceStatusHandlers();
			websocket.disconnect();
		};
	});
</script>

<TopBar />
<main class="min-h-screen bg-background pb-4">
	{@render children()}
</main>
<Toast />
<BottomNav />
