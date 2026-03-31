<script lang="ts">
	interface Props {
		connected: boolean;
	}
	let { connected }: Props = $props();
</script>

<div
	class="fixed top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full text-sm {connected
		? 'bg-success/20 text-success'
		: 'bg-warning/20 text-warning'}"
>
	<span class="w-2 h-2 rounded-full {connected ? 'bg-success' : 'bg-warning animate-pulse'}"></span>
	{connected ? 'Connected' : 'Reconnecting...'}
</div>
