<script lang="ts">
	/**
	 * Call control buttons for video call UI.
	 * Provides mute, video toggle, screen share, and end call controls.
	 */

	interface Props {
		isMuted: boolean
		isVideoOff: boolean
		isScreenSharing: boolean
		disabled?: boolean
		onToggleMute: () => void
		onToggleVideo: () => void
		onToggleScreenShare: () => void
		onEndCall: () => void
	}

	let {
		isMuted,
		isVideoOff,
		isScreenSharing,
		disabled = false,
		onToggleMute,
		onToggleVideo,
		onToggleScreenShare,
		onEndCall
	}: Props = $props()

	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return

		// Keyboard shortcuts: M for mute, V for video, S for screen share
		if (e.key === 'm' || e.key === 'M') {
			e.preventDefault()
			onToggleMute()
		} else if (e.key === 'v' || e.key === 'V') {
			e.preventDefault()
			onToggleVideo()
		} else if (e.key === 's' || e.key === 'S') {
			e.preventDefault()
			onToggleScreenShare()
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex items-center justify-center gap-4" role="toolbar" aria-label="Call controls">
	<!-- Mute button -->
	<button
		type="button"
		onclick={onToggleMute}
		{disabled}
		class="w-12 h-12 rounded-full flex items-center justify-center transition-all
			{isMuted
			? 'bg-red-500 text-white hover:bg-red-600'
			: 'bg-white/20 text-white hover:bg-white/30'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
		aria-pressed={isMuted}
	>
		{#if isMuted}
			<!-- Muted icon -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="w-6 h-6"
			>
				<path d="M13 7.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.06 12.44a1 1 0 0 1 1.41 0l.03.03a1 1 0 0 1-1.41 1.41l-.03-.03a1 1 0 0 1 0-1.41Z" />
				<path
					fill-rule="evenodd"
					d="M12 1.25a.75.75 0 0 1 .75.75v.356a7.002 7.002 0 0 1 5.27 2.924l-.78-.78a.75.75 0 1 1 1.06 1.06l2 2c.293.293.293.767 0 1.06l-2 2a.75.75 0 1 1-1.06-1.06l.78-.78A5.5 5.5 0 0 0 6.5 12a5.5 5.5 0 0 0 1.47 3.75l.78-.78a.75.75 0 0 1 1.06 1.06l-2 2a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06l.78.78A7.002 7.002 0 0 1 5 12c0-3.866 3.134-7 7-7V2a.75.75 0 0 1 .75-.75Z"
					clip-rule="evenodd"
				/>
				<path
					d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l7.22 7.22-2.22 2.22a.75.75 0 0 0 1.06 1.06l2.22-2.22 7.22 7.22a.75.75 0 1 0 1.06-1.06l-15.5-15.5Z"
				/>
				<path
					d="M12 2.25c-1.17 0-2.12.95-2.12 2.12v5.38c0 .315.069.615.193.884L15.5 4.19A2.12 2.12 0 0 0 12 2.25Z"
				/>
				<path
					d="M12 10.38 9.06 13.31a2.12 2.12 0 0 0 4.82-.69l-1.88-2.24ZM6 9.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-.75-.75ZM17.25 10.5a.75.75 0 0 1 1.5 0V12a6.75 6.75 0 0 1-6 6.709V21h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5v-2.291A6.75 6.75 0 0 1 5.25 12v-.75a.75.75 0 0 1 1.5 0v.75a5.25 5.25 0 1 0 10.5 0v-1.5Z"
				/>
			</svg>
		{:else}
			<!-- Unmuted icon -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="w-6 h-6"
			>
				<path
					d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z"
				/>
				<path
					d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z"
				/>
			</svg>
		{/if}
	</button>

	<!-- Video toggle button -->
	<button
		type="button"
		onclick={onToggleVideo}
		{disabled}
		class="w-12 h-12 rounded-full flex items-center justify-center transition-all
			{isVideoOff
			? 'bg-red-500 text-white hover:bg-red-600'
			: 'bg-white/20 text-white hover:bg-white/30'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		aria-label={isVideoOff ? 'Turn video on' : 'Turn video off'}
		aria-pressed={isVideoOff}
	>
		{#if isVideoOff}
			<!-- Video off icon -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="w-6 h-6"
			>
				<path
					d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a.75.75 0 0 0-.176-1.046l-3.75-2.5a.75.75 0 0 0-1.186.554l-.031 6.316a.75.75 0 0 0 1.156.65l3.5-2.192a.75.75 0 0 0 .487-.782ZM2.25 6A2.25 2.25 0 0 0 0 8.25v7.5A2.25 2.25 0 0 0 2.25 18h10.5a2.25 2.25 0 0 0 1.912-1.064L2.474 4.748A2.238 2.238 0 0 0 2.25 6Zm9.69-1.5H12.75a2.25 2.25 0 0 1 2.25 2.25v.75L4.56 4.5h7.38Z"
				/>
			</svg>
		{:else}
			<!-- Video on icon -->
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

	<!-- Screen share button -->
	<button
		type="button"
		onclick={onToggleScreenShare}
		{disabled}
		class="w-12 h-12 rounded-full flex items-center justify-center transition-all
			{isScreenSharing
			? 'bg-green-500 text-white hover:bg-green-600'
			: 'bg-white/20 text-white hover:bg-white/30'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
		aria-pressed={isScreenSharing}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			class="w-6 h-6"
		>
			<path
				fill-rule="evenodd"
				d="M2.25 6a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v7.5a3 3 0 0 1-3 3H15a.75.75 0 0 0-.75.75v1.042a3 3 0 0 1-1.5 0V17.25A.75.75 0 0 0 12 16.5h-.75v1.042a3 3 0 0 1-1.5 0V16.5H9a.75.75 0 0 0-.75.75v1.042a3 3 0 0 1-1.5 0V17.25A.75.75 0 0 0 6 16.5H5.25a3 3 0 0 1-3-3V6Zm3-.75A.75.75 0 0 0 4.5 6v7.5c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H5.25Z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>

	<!-- End call button -->
	<button
		type="button"
		onclick={onEndCall}
		{disabled}
		class="w-14 h-12 rounded-full bg-red-600 text-white flex items-center justify-center
			hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
		aria-label="End call"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			class="w-6 h-6 rotate-[135deg]"
		>
			<path
				fill-rule="evenodd"
				d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>
</div>
