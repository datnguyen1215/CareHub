<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getCallState, resetCallState, type CallState } from '$lib/stores/call';
	import IncomingCall from './IncomingCall.svelte';
	import CallScreen from './CallScreen.svelte';
	import PermissionError from './PermissionError.svelte';

	let callState: CallState = $state(getCallState());
	let updateInterval: ReturnType<typeof setInterval> | null = null;
	let endedTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		// Poll call state (Svelte 5 runes in module scope don't auto-subscribe across components)
		// Note: initCallStore() is called in +layout.svelte before WebSocket connects
		updateInterval = setInterval(() => {
			callState = getCallState();
		}, 50);
	});

	onDestroy(() => {
		if (updateInterval) clearInterval(updateInterval);
		if (endedTimeout) clearTimeout(endedTimeout);
	});

	// Auto-reset after call ended with brief delay
	$effect(() => {
		if (callState.status === 'ended' && !callState.error) {
			// Clear any existing timeout to prevent multiple resets
			if (endedTimeout) clearTimeout(endedTimeout);
			endedTimeout = setTimeout(() => {
				resetCallState();
			}, 2000);
		}
	});
</script>

{#if callState.status === 'incoming' && callState.caller}
	<IncomingCall caller={callState.caller} />
{:else if (callState.status === 'connecting' || callState.status === 'connected') && callState.caller}
	<CallScreen
		status={callState.status}
		caller={callState.caller}
		localStream={callState.localStream}
		remoteStream={callState.remoteStream}
		duration={callState.duration}
	/>
{:else if callState.status === 'ended' && callState.error}
	<PermissionError error={callState.error} />
{:else if callState.status === 'ended' && !callState.error}
	<!-- Brief "call ended" display -->
	<div class="call-ended-overlay">
		<div class="call-ended-content">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="ended-icon"
			>
				<path
					d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
				/>
			</svg>
			<h1 class="ended-text">Call Ended</h1>
		</div>
	</div>
{/if}

<style>
	.call-ended-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
	}

	.call-ended-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.ended-icon {
		width: 80px;
		height: 80px;
		color: rgba(255, 255, 255, 0.5);
		transform: rotate(135deg);
	}

	.ended-text {
		font-size: 2.5rem;
		font-weight: bold;
		color: white;
	}

	@media (min-width: 768px) {
		.ended-icon {
			width: 100px;
			height: 100px;
		}

		.ended-text {
			font-size: 3rem;
		}
	}
</style>
