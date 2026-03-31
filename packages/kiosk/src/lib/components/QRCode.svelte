<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		value: string;
		size?: number;
	}
	let { value, size = 280 }: Props = $props();

	let canvas: HTMLCanvasElement | null = $state(null);

	// Simple QR code placeholder - in production, use a library like qrcode
	// For now, display the code as large text for manual entry
	$effect(() => {
		if (canvas && value) {
			drawQRPlaceholder();
		}
	});

	function drawQRPlaceholder() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Draw white background
		ctx.fillStyle = '#FFFFFF';
		ctx.fillRect(0, 0, size, size);

		// Draw border
		ctx.strokeStyle = '#333333';
		ctx.lineWidth = 4;
		ctx.strokeRect(2, 2, size - 4, size - 4);

		// Draw QR code pattern (simplified visual)
		ctx.fillStyle = '#333333';

		// Corner squares
		const cornerSize = 40;
		ctx.fillRect(20, 20, cornerSize, cornerSize);
		ctx.fillRect(size - 20 - cornerSize, 20, cornerSize, cornerSize);
		ctx.fillRect(20, size - 20 - cornerSize, cornerSize, cornerSize);

		// Inner white squares
		ctx.fillStyle = '#FFFFFF';
		ctx.fillRect(30, 30, 20, 20);
		ctx.fillRect(size - 50, 30, 20, 20);
		ctx.fillRect(30, size - 50, 20, 20);

		// Code text in center
		ctx.fillStyle = '#333333';
		ctx.font = 'bold 32px system-ui';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(value, size / 2, size / 2);
	}
</script>

<canvas bind:this={canvas} width={size} height={size} class="rounded-lg shadow-lg"></canvas>
