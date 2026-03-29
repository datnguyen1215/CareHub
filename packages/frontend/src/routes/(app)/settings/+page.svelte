<script lang="ts">
	import { onMount } from 'svelte';
	import { listGroups } from '$lib/api';

	const API_BASE = import.meta.env.VITE_API_URL ?? '';

	interface Group {
		id: string;
		name: string;
		created_at: string;
	}

	let groups = $state<Group[]>([]);
	let groupName = $state('');
	let activeGroupId = $state('');
	let loadError = $state('');
	let saveError = $state('');
	let saveSuccess = $state(false);
	let loading = $state(false);

	onMount(async () => {
		try {
			groups = await listGroups();
			if (groups.length > 0) {
				activeGroupId = groups[0].id;
				groupName = groups[0].name;
			}
		} catch {
			loadError = 'Failed to load groups';
		}
	});

	async function handleSave(e: SubmitEvent) {
		e.preventDefault();
		saveError = '';
		saveSuccess = false;
		loading = true;

		try {
			const res = await fetch(`${API_BASE}/api/groups/${activeGroupId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ name: groupName })
			});

			if (!res.ok) {
				const data = await res.json();
				saveError = data.error ?? 'Failed to save';
				return;
			}

			const updated: Group = await res.json();
			groups = groups.map((g) => (g.id === updated.id ? updated : g));
			saveSuccess = true;
		} catch {
			saveError = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-lg mx-auto px-unit-3 py-unit-3">
	<h2 class="text-h2 font-semibold text-text-primary mb-unit-3">Settings</h2>

	{#if loadError}
		<div class="card">
			<p class="text-danger">{loadError}</p>
		</div>
	{:else if groups.length === 0}
		<div class="card">
			<p class="text-text-secondary">No groups found.</p>
		</div>
	{:else}
		<div class="card">
			<h3 class="text-h3 font-semibold text-text-primary mb-unit-2">Group</h3>

			<form onsubmit={handleSave} class="flex flex-col gap-unit-2">
				<div>
					<label for="group-name" class="block text-sm font-medium text-text-primary mb-1">
						Group name
					</label>
					<input
						id="group-name"
						type="text"
						bind:value={groupName}
						required
						class="w-full border border-gray-300 rounded-card px-unit-2 py-unit-1 text-base focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>

				{#if saveError}
					<p class="text-danger text-sm">{saveError}</p>
				{/if}

				{#if saveSuccess}
					<p class="text-success text-sm">Group name saved.</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="self-start bg-primary text-white rounded-card px-unit-3 py-unit-1 font-medium text-base hover:opacity-90 disabled:opacity-60 transition-opacity"
				>
					{loading ? 'Saving…' : 'Save'}
				</button>
			</form>
		</div>
	{/if}
</div>
