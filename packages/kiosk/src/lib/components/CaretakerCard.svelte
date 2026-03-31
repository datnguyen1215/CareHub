<script lang="ts">
	import type { Caretaker } from '$lib/services/api';

	interface Props {
		caretaker: Caretaker;
		onclick?: () => void;
	}
	let { caretaker, onclick }: Props = $props();

	function getDisplayName(): string {
		if (caretaker.first_name || caretaker.last_name) {
			return [caretaker.first_name, caretaker.last_name].filter(Boolean).join(' ');
		}
		return caretaker.email.split('@')[0];
	}

	function getInitials(): string {
		const name = getDisplayName();
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<button class="caretaker-card w-full" {onclick}>
	{#if caretaker.avatar_url}
		<img
			src={caretaker.avatar_url}
			alt={getDisplayName()}
			class="w-16 h-16 rounded-full object-cover flex-shrink-0"
		/>
	{:else}
		<div
			class="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"
		>
			<span class="text-xl font-bold text-primary">{getInitials()}</span>
		</div>
	{/if}
	<div class="flex-1 text-left">
		<span class="text-xl font-semibold text-text-primary block">{getDisplayName()}</span>
		<span class="text-text-secondary">Tap to call</span>
	</div>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		class="w-10 h-10 text-success flex-shrink-0"
	>
		<path
			fill-rule="evenodd"
			d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
			clip-rule="evenodd"
		/>
	</svg>
</button>
