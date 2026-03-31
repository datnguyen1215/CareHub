<script lang="ts">
	/**
	 * Full-screen modal for active video calls.
	 * Displays local/remote video streams, call status, and controls.
	 */

	import { onMount } from 'svelte';
	import { createFocusTrap } from '$lib/focusTrap';
	import CallControls from './CallControls.svelte';
	import type { CallStatusType } from '$lib/stores/call.svelte';

	interface Props {
		status: CallStatusType;
		deviceName: string | null;
		localStream: MediaStream | null;
		remoteStream: MediaStream | null;
		duration: number;
		error: string | null;
		isMuted: boolean;
		isVideoOff: boolean;
		onToggleMute: () => void;
		onToggleVideo: () => void;
		onEndCall: () => void;
		onRetry?: () => void;
	}

	let {
		status,
		deviceName,
		localStream,
		remoteStream,
		duration,
		error,
		isMuted,
		isVideoOff,
		onToggleMute,
		onToggleVideo,
		onEndCall,
		onRetry
	}: Props = $props();

	let modalElement: HTMLDivElement | null = $state(null);
	let localVideoElement: HTMLVideoElement | null = $state(null);
	let remoteVideoElement: HTMLVideoElement | null = $state(null);
	let cleanupFocusTrap: (() => void) | null = null;

	// Format duration as MM:SS
	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	// Attach local stream to video element
	$effect(() => {
		if (localVideoElement && localStream) {
			localVideoElement.srcObject = localStream;
		}
	});

	// Attach remote stream to video element
	$effect(() => {
		if (remoteVideoElement && remoteStream) {
			remoteVideoElement.srcObject = remoteStream;
		}
	});

	// Setup focus trap on mount
	onMount(() => {
		if (modalElement) {
			cleanupFocusTrap = createFocusTrap(modalElement, onEndCall);
		}

		return () => {
			if (cleanupFocusTrap) {
				cleanupFocusTrap();
			}
		};
	});

	// Computed states
	const isConnecting = $derived(
		status === 'initiating' || status === 'ringing' || status === 'connecting'
	);
	const isConnected = $derived(status === 'connected');
	const isFailed = $derived(status === 'failed');
	const isEnded = $derived(status === 'ended');
	const controlsDisabled = $derived(status === 'initiating' || status === 'connecting');

	// Status display text
	const statusText = $derived.by(() => {
		switch (status) {
			case 'initiating':
				return `Calling ${deviceName ?? 'device'}...`;
			case 'ringing':
				return 'Ringing...';
			case 'connecting':
				return 'Connecting...';
			case 'connected':
				return formatDuration(duration);
			case 'ended':
				return 'Call ended';
			case 'failed':
				return error ?? 'Call failed';
			default:
				return '';
		}
	});

	// Check if error is retryable
	const canRetry = $derived(
		isFailed && error !== null && !error.includes('declined') && !error.includes('permission')
	);
</script>

<!-- Full-screen modal overlay -->
<div
	bind:this={modalElement}
	class="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a]"
	role="dialog"
	aria-modal="true"
	aria-label="Video call"
>
	<!-- Status bar at top -->
	<div class="flex items-center justify-between px-4 py-3 bg-black/50">
		<div class="flex items-center gap-3">
			<span class="text-white font-semibold truncate max-w-[200px]">
				{deviceName ?? 'Unknown Device'}
			</span>
			{#if isConnected}
				<span class="text-green-400 text-sm">● Connected</span>
			{/if}
		</div>
		<div class="text-white/70 text-sm">
			{statusText}
		</div>
	</div>

	<!-- Main content area -->
	<div class="flex-1 relative overflow-hidden">
		{#if isConnecting}
			<!-- Connecting state -->
			<div class="absolute inset-0 flex flex-col items-center justify-center text-white">
				<!-- Animated spinner -->
				<div class="w-16 h-16 mb-6">
					<svg class="animate-spin" viewBox="0 0 24 24" fill="none">
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
				</div>
				<p class="text-xl font-semibold mb-2">{statusText}</p>
				<p class="text-white/50 text-sm">Please wait...</p>
			</div>
		{:else if isFailed || isEnded}
			<!-- Failed or ended state -->
			<div class="absolute inset-0 flex flex-col items-center justify-center text-white">
				{#if isFailed}
					<!-- Error icon -->
					<div class="w-16 h-16 mb-6 text-red-400">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<p class="text-xl font-semibold mb-2 text-center px-4">{error ?? 'Call failed'}</p>
				{:else}
					<!-- Call ended icon -->
					<div class="w-16 h-16 mb-6 text-white/50">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<p class="text-xl font-semibold mb-2">{error ?? 'Call ended'}</p>
				{/if}

				<div class="flex gap-3 mt-6">
					{#if canRetry && onRetry}
						<button
							type="button"
							onclick={onRetry}
							class="px-6 py-2.5 bg-primary text-white rounded-full font-semibold hover:bg-blue-600 transition-colors"
						>
							Try Again
						</button>
					{/if}
					<button
						type="button"
						onclick={onEndCall}
						class="px-6 py-2.5 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-colors"
					>
						Close
					</button>
				</div>
			</div>
		{:else if isConnected}
			<!-- Connected state with video streams -->

			<!-- Remote video (full screen) -->
			{#if remoteStream}
				<video
					bind:this={remoteVideoElement}
					autoplay
					playsinline
					class="w-full h-full object-cover"
					aria-label="Remote video"
				>
					<track kind="captions" />
				</video>
			{:else}
				<!-- Placeholder when no remote video -->
				<div class="absolute inset-0 flex items-center justify-center">
					<div
						class="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-white/50"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-12 h-12"
						>
							<path
								fill-rule="evenodd"
								d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				</div>
			{/if}

			<!-- Local video (picture-in-picture) -->
			{#if localStream && !isVideoOff}
				<div
					class="absolute bottom-24 right-4 w-32 h-44 rounded-lg overflow-hidden shadow-lg border-2 border-white/20 bg-black"
				>
					<video
						bind:this={localVideoElement}
						autoplay
						playsinline
						muted
						class="w-full h-full object-cover"
						style="transform: scaleX(-1)"
						aria-label="Local video preview"
					>
						<track kind="captions" />
					</video>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Controls bar at bottom -->
	{#if !isEnded && !isFailed}
		<div class="px-4 py-6 bg-gradient-to-t from-black/80 to-transparent">
			<CallControls
				{isMuted}
				{isVideoOff}
				disabled={controlsDisabled}
				{onToggleMute}
				{onToggleVideo}
				{onEndCall}
			/>
		</div>
	{/if}
</div>
