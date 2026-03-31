<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import type { CallParticipant } from '@carehub/shared'
	import type { CallStatus } from '$lib/stores/call'
	import { endCall, formatDuration } from '$lib/stores/call'
	import { attachRemoteStream } from '$lib/services/webrtc'

	interface Props {
		status: CallStatus
		caller: CallParticipant
		localStream: MediaStream | null
		remoteStream: MediaStream | null
		duration: number
	}
	let { status, caller, localStream, remoteStream, duration }: Props = $props()

	let remoteVideoElement: HTMLVideoElement | null = $state(null)
	let localVideoElement: HTMLVideoElement | null = $state(null)

	function getDisplayName(): string {
		if (caller.name) {
			return caller.name
		}
		return 'Unknown Caller'
	}

	function getInitials(): string {
		const name = getDisplayName()
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	}

	function handleEndCall() {
		endCall()
	}

	// Attach streams to video elements reactively
	$effect(() => {
		if (remoteVideoElement && remoteStream) {
			attachRemoteStream(remoteVideoElement, remoteStream)
		}
	})

	$effect(() => {
		if (localVideoElement && localStream) {
			localVideoElement.srcObject = localStream
		}
	})
</script>

<div class="call-screen">
	<!-- Remote video (full screen) -->
	<div class="remote-video-container">
		{#if remoteStream}
			<video
				bind:this={remoteVideoElement}
				autoplay
				playsinline
				class="remote-video"
			></video>
		{:else}
			<!-- Show avatar when no video -->
			<div class="no-video-placeholder">
				{#if caller.avatarUrl}
					<img
						src={caller.avatarUrl}
						alt={getDisplayName()}
						class="placeholder-avatar"
					/>
				{:else}
					<div class="placeholder-avatar-initials">
						<span>{getInitials()}</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Local video preview (small corner) -->
	{#if localStream}
		<div class="local-video-container">
			<video
				bind:this={localVideoElement}
				autoplay
				playsinline
				muted
				class="local-video"
			></video>
		</div>
	{/if}

	<!-- Call info overlay -->
	<div class="call-info-overlay">
		<div class="call-header">
			<h1 class="caller-name">{getDisplayName()}</h1>
			{#if status === 'connecting'}
				<p class="call-status connecting">
					<span class="connecting-dot"></span>
					<span class="connecting-dot"></span>
					<span class="connecting-dot"></span>
					Connecting...
				</p>
			{:else if status === 'connected'}
				<p class="call-status">{formatDuration(duration)}</p>
			{/if}
		</div>

		<!-- End call button -->
		<div class="call-controls">
			<button
				class="end-call-button"
				onclick={handleEndCall}
				aria-label="End call"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="end-call-icon">
					<path d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" />
				</svg>
				<span class="end-call-text">End Call</span>
			</button>
		</div>
	</div>
</div>

<style>
	.call-screen {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: #000;
		display: flex;
		flex-direction: column;
	}

	/* Remote video - full screen */
	.remote-video-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a1a1a;
		overflow: hidden;
	}

	.remote-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-video-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
	}

	.placeholder-avatar {
		width: 200px;
		height: 200px;
		border-radius: 50%;
		object-fit: cover;
		border: 4px solid rgba(255, 255, 255, 0.2);
	}

	.placeholder-avatar-initials {
		width: 200px;
		height: 200px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 4px solid rgba(255, 255, 255, 0.2);
	}

	.placeholder-avatar-initials span {
		font-size: 4rem;
		font-weight: bold;
		color: white;
	}

	/* Local video preview */
	.local-video-container {
		position: absolute;
		bottom: 120px;
		right: 24px;
		width: 120px;
		height: 160px;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	}

	.local-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scaleX(-1); /* Mirror for natural feel */
	}

	/* Call info overlay */
	.call-info-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		pointer-events: none;
		padding: 1.5rem;
	}

	.call-header {
		text-align: center;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
		padding: 1.5rem;
		margin: -1.5rem -1.5rem 0;
	}

	.caller-name {
		font-size: 2rem;
		font-weight: bold;
		color: white;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}

	.call-status {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.9);
		margin-top: 0.5rem;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.call-status.connecting {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}

	.connecting-dot {
		width: 8px;
		height: 8px;
		background: white;
		border-radius: 50%;
		animation: connecting-pulse 1.4s ease-in-out infinite both;
	}

	.connecting-dot:nth-child(1) {
		animation-delay: -0.32s;
	}

	.connecting-dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes connecting-pulse {
		0%, 80%, 100% {
			transform: scale(0.6);
			opacity: 0.5;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Call controls */
	.call-controls {
		display: flex;
		justify-content: center;
		padding-bottom: 1rem;
		pointer-events: auto;
	}

	.end-call-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		color: white;
		border: none;
		border-radius: 50px;
		padding: 1.25rem 3rem;
		min-height: 80px;
		min-width: 220px;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
	}

	.end-call-button:hover {
		transform: scale(1.02);
	}

	.end-call-button:active {
		transform: scale(0.98);
	}

	.end-call-icon {
		width: 36px;
		height: 36px;
		transform: rotate(135deg);
	}

	.end-call-text {
		font-size: 1.5rem;
		font-weight: 600;
	}

	/* Responsive for landscape tablet */
	@media (min-width: 768px) {
		.local-video-container {
			width: 160px;
			height: 200px;
			bottom: 130px;
			right: 32px;
		}

		.caller-name {
			font-size: 2.5rem;
		}

		.end-call-button {
			min-width: 260px;
			padding: 1.5rem 4rem;
		}

		.end-call-icon {
			width: 40px;
			height: 40px;
		}

		.end-call-text {
			font-size: 1.75rem;
		}
	}
</style>
