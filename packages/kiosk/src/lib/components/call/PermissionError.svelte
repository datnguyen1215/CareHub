<script lang="ts">
	import { resetCallState } from '$lib/stores/call'
	import { requestMediaPermissions } from '$lib/services/permissions'

	interface Props {
		error: string
	}
	let { error }: Props = $props()

	let isRetrying = $state(false)

	async function handleRetry() {
		isRetrying = true
		const granted = await requestMediaPermissions()
		isRetrying = false

		if (granted) {
			// Reset and let user try the call again
			resetCallState()
		}
	}

	function handleDismiss() {
		resetCallState()
	}
</script>

<div class="permission-error-overlay">
	<div class="error-content">
		<!-- Warning icon -->
		<div class="error-icon">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
			</svg>
		</div>

		<h1 class="error-title">Permission Required</h1>

		<p class="error-message">
			{error || 'Camera and microphone access is needed for video calls.'}
		</p>

		<div class="instructions">
			<p class="instruction-text">
				To make video calls, please allow camera and microphone access when prompted.
			</p>

			<p class="instruction-detail">
				If you previously denied access, you may need to go to your device settings to enable it.
			</p>
		</div>

		<div class="error-actions">
			<button
				class="action-button retry-button"
				onclick={handleRetry}
				disabled={isRetrying}
			>
				{#if isRetrying}
					<span class="spinner"></span>
					Checking...
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="action-icon">
						<path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clip-rule="evenodd" />
					</svg>
					Try Again
				{/if}
			</button>

			<button
				class="action-button dismiss-button"
				onclick={handleDismiss}
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="action-icon">
					<path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
				</svg>
				Close
			</button>
		</div>
	</div>
</div>

<style>
	.permission-error-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
		padding: 2rem;
	}

	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 600px;
	}

	.error-icon {
		width: 100px;
		height: 100px;
		background: rgba(251, 191, 36, 0.2);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.error-icon svg {
		width: 60px;
		height: 60px;
		color: #fbbf24;
	}

	.error-title {
		font-size: 2.5rem;
		font-weight: bold;
		color: white;
		margin-bottom: 1rem;
	}

	.error-message {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	.instructions {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 1.5rem 2rem;
		margin-bottom: 2.5rem;
	}

	.instruction-text {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.instruction-detail {
		font-size: 1.125rem;
		color: rgba(255, 255, 255, 0.7);
		line-height: 1.5;
	}

	.error-actions {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.action-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem 2rem;
		min-height: 70px;
		min-width: 180px;
		border-radius: 12px;
		border: none;
		font-size: 1.25rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.action-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.action-button:not(:disabled):hover {
		transform: scale(1.02);
	}

	.action-button:not(:disabled):active {
		transform: scale(0.98);
	}

	.retry-button {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
		color: white;
		box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
	}

	.dismiss-button {
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.action-icon {
		width: 28px;
		height: 28px;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Responsive for landscape tablet */
	@media (min-width: 768px) {
		.error-icon {
			width: 120px;
			height: 120px;
		}

		.error-icon svg {
			width: 70px;
			height: 70px;
		}

		.error-title {
			font-size: 3rem;
		}

		.action-button {
			min-width: 200px;
			padding: 1.25rem 2.5rem;
		}
	}
</style>
