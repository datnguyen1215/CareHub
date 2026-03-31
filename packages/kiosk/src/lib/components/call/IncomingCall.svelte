<script lang="ts">
	import type { CallParticipant } from '@carehub/shared'
	import { acceptCall, declineCall } from '$lib/stores/call'

	interface Props {
		caller: CallParticipant
	}
	let { caller }: Props = $props()

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

	function handleAccept() {
		acceptCall()
	}

	function handleDecline() {
		declineCall()
	}
</script>

<div class="incoming-call-overlay">
	<!-- Ring animation -->
	<div class="ring-animation"></div>

	<!-- Caller info -->
	<div class="caller-info">
		{#if caller.avatarUrl}
			<img
				src={caller.avatarUrl}
				alt={getDisplayName()}
				class="caller-avatar"
			/>
		{:else}
			<div class="caller-avatar-placeholder">
				<span class="caller-initials">{getInitials()}</span>
			</div>
		{/if}

		<p class="incoming-label">Incoming call from</p>
		<h1 class="caller-name">{getDisplayName()}</h1>
	</div>

	<!-- Action buttons -->
	<div class="call-actions">
		<button
			class="call-button decline-button"
			onclick={handleDecline}
			aria-label="Decline call"
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="button-icon">
				<path d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" />
			</svg>
			<span class="button-text">Decline</span>
		</button>

		<button
			class="call-button accept-button"
			onclick={handleAccept}
			aria-label="Accept call"
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="button-icon">
				<path fill-rule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clip-rule="evenodd" />
			</svg>
			<span class="button-text">Answer</span>
		</button>
	</div>
</div>

<style>
	.incoming-call-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
		padding: 2rem;
	}

	/* Ring animation behind avatar */
	.ring-animation {
		position: absolute;
		width: 180px;
		height: 180px;
		border-radius: 50%;
		border: 4px solid rgba(34, 197, 94, 0.5);
		animation: ring-pulse 1.5s ease-out infinite;
	}

	@keyframes ring-pulse {
		0% {
			transform: scale(0.8);
			opacity: 1;
		}
		100% {
			transform: scale(1.4);
			opacity: 0;
		}
	}

	.caller-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		z-index: 1;
	}

	.caller-avatar {
		width: 140px;
		height: 140px;
		border-radius: 50%;
		object-fit: cover;
		border: 4px solid white;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.caller-avatar-placeholder {
		width: 140px;
		height: 140px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 4px solid white;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.caller-initials {
		font-size: 3rem;
		font-weight: bold;
		color: white;
	}

	.incoming-label {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.7);
		margin-top: 1rem;
	}

	.caller-name {
		font-size: 2.5rem;
		font-weight: bold;
		color: white;
		text-align: center;
		max-width: 90%;
	}

	/* Action buttons */
	.call-actions {
		display: flex;
		gap: 3rem;
		margin-top: 3rem;
	}

	.call-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 120px;
		height: 120px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
	}

	.call-button:hover {
		transform: scale(1.05);
	}

	.call-button:active {
		transform: scale(0.95);
	}

	.accept-button {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
		color: white;
	}

	.decline-button {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		color: white;
	}

	.button-icon {
		width: 48px;
		height: 48px;
	}

	.decline-button .button-icon {
		transform: rotate(135deg);
	}

	.button-text {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 0.25rem;
	}

	/* Responsive for landscape tablet */
	@media (min-width: 768px) {
		.caller-avatar,
		.caller-avatar-placeholder {
			width: 160px;
			height: 160px;
		}

		.ring-animation {
			width: 200px;
			height: 200px;
		}

		.caller-name {
			font-size: 3rem;
		}

		.call-button {
			width: 140px;
			height: 140px;
		}

		.button-icon {
			width: 56px;
			height: 56px;
		}

		.button-text {
			font-size: 1.25rem;
		}
	}
</style>
