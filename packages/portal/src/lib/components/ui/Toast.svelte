<script lang="ts">
	import { toast, type Toast } from '$lib/stores/toast'
	import { fly } from 'svelte/transition'

	let toasts = $state<Toast[]>([])

	$effect(() => {
		const unsubscribe = toast.subscribe((value) => {
			toasts = value
		})
		return unsubscribe
	})

	function getIcon(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'check'
			case 'destructive':
				return 'x'
			case 'error':
				return 'exclamation'
			case 'warning':
				return 'exclamation'
			case 'info':
				return 'info'
		}
	}

	function getColors(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'bg-green-50 border-green-200 text-green-800'
			case 'destructive':
			case 'error':
				return 'bg-red-50 border-red-200 text-red-800'
			case 'warning':
				return 'bg-amber-50 border-amber-200 text-amber-800'
			case 'info':
				return 'bg-blue-50 border-blue-200 text-blue-800'
		}
	}

	function getIconColors(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'bg-green-100 text-green-600'
			case 'destructive':
			case 'error':
				return 'bg-red-100 text-red-600'
			case 'warning':
				return 'bg-amber-100 text-amber-600'
			case 'info':
				return 'bg-blue-100 text-blue-600'
		}
	}
</script>

{#if toasts.length > 0}
	<div
		class="fixed bottom-20 left-0 right-0 z-40 flex flex-col items-center gap-2 px-unit-2 pointer-events-none"
		aria-live="polite"
	>
		{#each toasts as t (t.id)}
			<div
				class="flex items-center gap-3 px-4 py-3 rounded-card border shadow-lg pointer-events-auto max-w-md w-full {getColors(t.type)}"
				transition:fly={{ y: 50, duration: 200 }}
				role="alert"
			>
				<!-- Icon -->
				<div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 {getIconColors(t.type)}">
					{#if getIcon(t.type) === 'check'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
							<path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
						</svg>
					{:else if getIcon(t.type) === 'x'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
							<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
						</svg>
					{:else if getIcon(t.type) === 'info'}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
							<path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
							<path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
						</svg>
					{/if}
				</div>

				<!-- Message -->
				<p class="text-sm font-medium flex-1">{t.message}</p>

				<!-- Dismiss button (for errors and warnings) -->
				{#if t.type === 'error' || t.type === 'warning'}
					<button
						onclick={() => toast.dismiss(t.id)}
						class="p-1 rounded hover:opacity-70 transition-opacity shrink-0"
						aria-label="Dismiss"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
							<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
						</svg>
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}
