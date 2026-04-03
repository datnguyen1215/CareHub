<script lang="ts">
	import type { CareProfile } from '$lib/api';
	import { getInitial } from './utils/format';

	interface Props {
		profiles: CareProfile[];
		selectedIds: string[];
		onSelectionChange: (ids: string[]) => void;
	}

	let { profiles, selectedIds, onSelectionChange }: Props = $props();

	function toggleProfile(id: string) {
		if (selectedIds.includes(id)) {
			onSelectionChange(selectedIds.filter((pid) => pid !== id));
		} else {
			onSelectionChange([...selectedIds, id]);
		}
	}

</script>

<div class="space-y-2">
	{#each profiles as profile (profile.id)}
		<button
			type="button"
			onclick={() => toggleProfile(profile.id)}
			class="w-full flex items-center gap-3 p-3 rounded-card border transition-colors
				{selectedIds.includes(profile.id)
				? 'border-primary bg-primary/5'
				: 'border-gray-200 hover:border-gray-300'}"
		>
			<!-- Checkbox -->
			<div
				class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
					{selectedIds.includes(profile.id) ? 'border-primary bg-primary' : 'border-gray-300'}"
			>
				{#if selectedIds.includes(profile.id)}
					<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				{/if}
			</div>

			<!-- Avatar -->
			<div
				class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden"
			>
				{#if profile.avatar_url}
					<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
				{:else}
					<span class="text-primary font-semibold text-sm">
						{getInitial(profile.name)}
					</span>
				{/if}
			</div>

			<!-- Name and relationship -->
			<div class="text-left flex-1 min-w-0">
				<p class="font-semibold text-text-primary truncate">{profile.name}</p>
				{#if profile.relationship}
					<p class="text-sm text-text-secondary capitalize">{profile.relationship}</p>
				{/if}
			</div>
		</button>
	{/each}
</div>
