<script lang="ts">
	import { onMount } from 'svelte';
	import { getMe, type MeResponse } from '$lib/api';
	import { goto } from '$app/navigation';
	import { getInitial } from '$lib/utils/format';

	let user = $state<MeResponse | null>(null);

	onMount(async () => {
		try {
			user = await getMe();
		} catch {
			// silently ignore — avatar just won't show initials
		}
	});
</script>

<header class="fixed top-0 left-0 right-0 bg-surface border-b border-gray-200 z-40">
	<div class="max-w-2xl mx-auto flex items-center justify-between px-unit-3 h-14">
		<span class="text-h3 font-bold text-primary tracking-tight">CareHub</span>

		<button
			onclick={() => goto('/settings')}
			class="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold hover:opacity-90 transition-opacity"
			aria-label="Go to settings"
		>
			{#if user}
				{getInitial(user.first_name || user.email)}
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-5 h-5"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
						clip-rule="evenodd"
					/>
				</svg>
			{/if}
		</button>
	</div>
</header>

<!-- Spacer to push content below the fixed header -->
<div class="h-14"></div>
