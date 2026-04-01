<script lang="ts">
	import { onMount } from 'svelte';
	import { callStore } from '$lib/stores/call.svelte';

	let callState = $derived(callStore.callState);
	let connectingTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		// Simulate connecting after 2 seconds when in calling state
		if (callState.status === 'calling') {
			connectingTimeout = setTimeout(() => {
				callStore.connect();
			}, 2000);
		}

		return () => {
			if (connectingTimeout) clearTimeout(connectingTimeout);
		};
	});

	function handleEndCall() {
		callStore.endCall();
	}

	function handleToggleMute() {
		callStore.toggleMute();
	}

	function handleToggleVideo() {
		callStore.toggleVideo();
	}

	const STATUS_LABEL: Record<string, string> = {
		calling: 'Calling…',
		connected: 'Connected',
		ended: 'Call ended'
	};

	let show = $derived(callState.status !== 'idle');
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-label="Call"
	>
		<div class="card w-full max-w-sm mx-unit-3 flex flex-col items-center gap-unit-3 py-unit-6">
			<!-- Device avatar placeholder -->
			<div
				class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400"
				aria-hidden="true"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-8 h-8"
				>
					<path
						fill-rule="evenodd"
						d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>

			<!-- Device name -->
			<h2 class="text-h3 font-semibold text-text-primary">
				{callState.deviceName ?? 'Unknown Device'}
			</h2>

			<!-- Status -->
			<p class="text-sm text-text-secondary">
				{STATUS_LABEL[callState.status] ?? callState.status}
			</p>

			<!-- Calling animation -->
			{#if callState.status === 'calling'}
				<div class="flex items-center gap-1 mt-1" aria-hidden="true">
					<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
					<span
						class="w-2 h-2 rounded-full bg-primary animate-pulse"
						style="animation-delay: 0.2s"
					></span>
					<span
						class="w-2 h-2 rounded-full bg-primary animate-pulse"
						style="animation-delay: 0.4s"
					></span>
				</div>
			{/if}

			<!-- Controls -->
			{#if callState.status !== 'ended'}
				<div class="flex items-center gap-unit-4 mt-unit-2">
					<!-- Mute -->
					<button
						onclick={handleToggleMute}
						disabled={callState.status !== 'connected'}
						class="w-12 h-12 rounded-full flex items-center justify-center transition-colors
							{callState.muted
								? 'bg-gray-200 text-text-primary'
								: 'bg-white border border-gray-300 text-text-primary hover:bg-gray-50'}
							disabled:opacity-50"
						aria-label={callState.muted ? 'Unmute' : 'Mute'}
					>
						{#if callState.muted}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="w-6 h-6"
							>
								<path
									d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-1.72 1.72-1.72-1.72Z"
								/>
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="w-6 h-6"
							>
								<path
									d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z"
								/>
								<path
									d="m15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z"
								/>
							</svg>
						{/if}
					</button>

					<!-- Video toggle -->
					<button
						onclick={handleToggleVideo}
						disabled={callState.status !== 'connected'}
						class="w-12 h-12 rounded-full flex items-center justify-center transition-colors
							{callState.videoEnabled
								? 'bg-gray-200 text-text-primary'
								: 'bg-white border border-gray-300 text-text-primary hover:bg-gray-50'}
							disabled:opacity-50"
						aria-label={callState.videoEnabled ? 'Stop video' : 'Start video'}
					>
						{#if callState.videoEnabled}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="w-6 h-6"
							>
								<path
									d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.5 17.69c0 .471-.202.862-.536 1.13l-2.3-2.3A3.748 3.748 0 0 0 19.5 12c0-1.073-.45-2.044-1.174-2.737l2.3-2.3c.334.268.536.66.536 1.13v9.697ZM15.75 6.75a.75.75 0 0 0 0 1.5h.008a.75.75 0 0 0 0-1.5H15.75Z"
								/>
								<path
									d="m2.874 14.67 2.3 2.3A3.748 3.748 0 0 1 4.5 12c0-1.073.45-2.044 1.174-2.737l-2.3-2.3A5.25 5.25 0 0 0 3 12c0 1.06.31 2.047.874 2.67Z"
								/>
								<path
									d="m6.926 16.81 1.5 1.5A3.748 3.748 0 0 0 12 19.5a3.748 3.748 0 0 0 3.574-3.19l-1.5-1.5A3.748 3.748 0 0 1 12 15.75a3.748 3.748 0 0 1-3.574 1.19l-1.5 1.5ZM8.25 3a.75.75 0 0 0 0 1.5h.008a.75.75 0 0 0 0-1.5H8.25Z"
								/>
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="w-6 h-6"
							>
								<path
									d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z"
								/>
							</svg>
						{/if}
					</button>

					<!-- End call -->
					<button
						onclick={handleEndCall}
						class="w-14 h-14 rounded-full bg-danger text-white flex items-center justify-center
						       hover:opacity-90 transition-opacity"
						aria-label="End call"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-7 h-7"
						>
							<path
								d="M15.75 3.75a.75.75 0 0 1 .75-.75h.75a2.25 2.25 0 0 1 2.25 2.25v.75a.75.75 0 0 1-1.5 0v-.75a.75.75 0 0 0-.75-.75h-.75a.75.75 0 0 1-.75-.75ZM3.75 15.75a.75.75 0 0 1 .75.75v.75c0 .414.336.75.75.75h.75a.75.75 0 0 1 0 1.5h-.75A2.25 2.25 0 0 1 3 17.25v-.75a.75.75 0 0 1 .75-.75ZM3 8.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.75-.75ZM3 11.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.75-.75ZM12 3a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75A.75.75 0 0 1 12 3ZM12 3.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-1.5 0v-.75A.75.75 0 0 1 12 3.75ZM8.25 3a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75A.75.75 0 0 1 8.25 3Z"
							/>
							<path
								fill-rule="evenodd"
								d="M2.925 2.925a3 3 0 0 0-1.086 3.714l1.268 3.17a3 3 0 0 0 3.357 2.034l1.174-.197a.75.75 0 0 1 .693 1.244l-.457.456a.75.75 0 0 0 .327 1.228l5.752 1.24a3 3 0 0 0 3.221-1.15l.612-.858a3 3 0 0 0-.041-3.49L15.47 6.416a3 3 0 0 0-3.221-1.15l-1.174.197a.75.75 0 0 1-.693-1.244l.457-.456a.75.75 0 0 0-.327-1.228L5.755 1.295a3 3 0 0 0-3.221 1.15l-.609.858Z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
