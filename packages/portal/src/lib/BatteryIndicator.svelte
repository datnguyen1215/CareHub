<script lang="ts">
	interface Props {
		level: number | null;
	}

	let { level }: Props = $props();

	const displayLevel = $derived(level ?? 0);
	const isLow = $derived(displayLevel <= 20);

	function getColorClass(lvl: number): string {
		if (lvl <= 20) return 'bg-danger';
		if (lvl <= 50) return 'bg-yellow-500';
		return 'bg-green-500';
	}
</script>

{#if level !== null}
	<div class="flex items-center gap-1.5">
		<div
			class="relative w-8 h-3.5 rounded border-2 {isLow
				? 'border-danger'
				: 'border-gray-400'} bg-white"
		>
			<!-- Battery terminal -->
			<div
				class="absolute -right-1 top-1/2 -translate-y-1/2 w-0.5 h-1.5 rounded-r {isLow
					? 'bg-danger'
					: 'bg-gray-400'}"
			></div>
			<!-- Fill level -->
			<div
				class="absolute left-0.5 top-0.5 bottom-0.5 rounded-sm {getColorClass(displayLevel)}"
				style="width: {Math.max(displayLevel, 5)}%"
			></div>
		</div>
		<span class="text-xs {isLow ? 'text-danger' : 'text-text-secondary'}">{displayLevel}%</span>
	</div>
{:else}
	<span class="text-xs text-text-secondary">—</span>
{/if}
