<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';

	interface Props {
		onScan: (data: string) => void;
		onError?: (error: string) => void;
	}

	let { onScan, onError }: Props = $props();

	let scanner: Html5Qrcode | null = null;
	let scannerError = $state('');
	let isScanning = $state(false);
	let showManualEntry = $state(false);
	let manualCode = $state('');

	const SCANNER_ID = 'qr-scanner-container';

	onMount(async () => {
		await startScanner();
	});

	onDestroy(() => {
		stopScanner();
	});

	async function startScanner() {
		try {
			scanner = new Html5Qrcode(SCANNER_ID);
			isScanning = true;
			scannerError = '';

			await scanner.start(
				{ facingMode: 'environment' },
				{
					fps: 10,
					qrbox: { width: 250, height: 250 }
				},
				(decodedText) => {
					// Haptic feedback if available
					if (navigator.vibrate) {
						navigator.vibrate(100);
					}
					onScan(decodedText);
					stopScanner();
				},
				() => {
					// Ignore scan errors (no QR found in frame)
				}
			);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Failed to access camera';
			if (
				errorMsg.includes('Permission') ||
				errorMsg.includes('denied') ||
				errorMsg.includes('NotAllowed')
			) {
				scannerError =
					'Camera access denied. Please allow camera access or enter the code manually.';
				showManualEntry = true;
			} else {
				scannerError = errorMsg;
			}
			isScanning = false;
			onError?.(scannerError);
		}
	}

	async function stopScanner() {
		if (scanner && isScanning) {
			try {
				await scanner.stop();
			} catch {
				// Ignore stop errors
			}
			isScanning = false;
		}
	}

	function handleManualSubmit() {
		const code = manualCode.trim().toUpperCase();
		if (code.length === 8) {
			onScan(code);
		}
	}

	function switchToManual() {
		stopScanner();
		showManualEntry = true;
	}
</script>

<div class="space-y-4">
	{#if !showManualEntry}
		<!-- QR Scanner -->
		<div class="relative">
			<!-- Scanner container -->
			<div id={SCANNER_ID} class="w-full aspect-square bg-black rounded-lg overflow-hidden"></div>

			<!-- Corner brackets overlay -->
			<div class="absolute inset-0 pointer-events-none">
				<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
					<!-- Top-left bracket -->
					<div
						class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl"
					></div>
					<!-- Top-right bracket -->
					<div
						class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr"
					></div>
					<!-- Bottom-left bracket -->
					<div
						class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl"
					></div>
					<!-- Bottom-right bracket -->
					<div
						class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br"
					></div>
				</div>
			</div>
		</div>

		<p class="text-center text-text-secondary text-sm">Position QR code in frame</p>

		{#if scannerError && !showManualEntry}
			<div class="text-center">
				<p class="text-danger text-sm mb-2">{scannerError}</p>
			</div>
		{/if}

		<button
			type="button"
			onclick={switchToManual}
			class="w-full text-center text-primary text-sm hover:underline"
		>
			Enter code manually instead
		</button>
	{:else}
		<!-- Manual Code Entry -->
		<div class="space-y-4">
			<p class="text-text-secondary text-sm text-center">
				Enter the 8-character code shown on the tablet screen
			</p>

			<input
				type="text"
				bind:value={manualCode}
				maxlength="8"
				placeholder="XXXXXXXX"
				class="w-full text-center text-2xl tracking-widest font-mono px-4 py-3 border border-gray-300 rounded-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
				oninput={(e) => {
					const input = e.currentTarget;
					input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
					manualCode = input.value;
				}}
			/>

			<button
				type="button"
				onclick={handleManualSubmit}
				disabled={manualCode.trim().length !== 8}
				class="w-full bg-primary text-white rounded-card px-unit-3 py-2 font-semibold text-base
					hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				Continue
			</button>

			<button
				type="button"
				onclick={() => {
					showManualEntry = false;
					startScanner();
				}}
				class="w-full text-center text-primary text-sm hover:underline"
			>
				Try scanning again
			</button>
		</div>
	{/if}
</div>
