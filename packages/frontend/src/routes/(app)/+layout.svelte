<script lang="ts">
	import TopBar from '$lib/TopBar.svelte';
	import BottomNav from '$lib/BottomNav.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<TopBar />
<main class="min-h-screen bg-background pb-4">
	{@render children()}
</main>
<BottomNav />
