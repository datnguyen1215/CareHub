<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '$lib/TopBar.svelte';
	import BottomNav from '$lib/BottomNav.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { Snippet } from 'svelte';
	import * as websocket from '$lib/services/websocket';
	import { initializeCallHandlers } from '$lib/stores/call.svelte';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// Connect WebSocket for real-time signaling
		websocket.connect();

		// Initialize call state handlers
		const cleanupCallHandlers = initializeCallHandlers();

		return () => {
			cleanupCallHandlers();
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
