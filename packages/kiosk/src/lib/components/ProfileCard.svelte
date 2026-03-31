<script lang="ts">
	import type { Profile } from '$lib/services/api';

	interface Props {
		profile: Profile;
		onclick?: () => void;
	}
	let { profile, onclick }: Props = $props();

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<button class="profile-card w-full" {onclick}>
	{#if profile.avatar_url}
		<img
			src={profile.avatar_url}
			alt={profile.name}
			class="w-24 h-24 rounded-full object-cover mb-unit-3"
		/>
	{:else}
		<div class="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-unit-3">
			<span class="text-3xl font-bold text-primary">{getInitials(profile.name)}</span>
		</div>
	{/if}
	<span class="text-2xl font-semibold text-text-primary">{profile.name}</span>
</button>
