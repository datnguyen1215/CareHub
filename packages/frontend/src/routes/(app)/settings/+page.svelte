<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listGroups, updateGroup, logout } from '$lib/api';
	import { getErrorMessage, isRetryable } from '$lib/error-utils';

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
	let logoutLoading = $state(false);
	let logoutError = $state('');
	let canRetry = $state(false);

	async function loadData() {
		loadError = '';
		canRetry = false;

		try {
			groups = await listGroups();
			if (groups.length > 0) {
				activeGroupId = groups[0].id;
				groupName = groups[0].name;
			}
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			loadError = getErrorMessage(err, 'load settings');
			canRetry = isRetryable(err);
		}
	}

	onMount(() => {
		loadData();
	});

	async function handleSave(e: SubmitEvent) {
		e.preventDefault();
		saveError = '';
		saveSuccess = false;
		loading = true;

		try {
			const updated = await updateGroup(activeGroupId, { name: groupName });
			groups = groups.map((g) => (g.id === updated.id ? updated : g));
			saveSuccess = true;
		} catch (err: unknown) {
			const apiErr = err as { status?: number };
			if (apiErr?.status === 401) {
				goto('/login');
				return;
			}
			saveError = getErrorMessage(err, 'save group name');
		} finally {
			loading = false;
		}
	}

	async function handleLogout() {
		logoutError = '';
		logoutLoading = true;

		try {
			await logout();
			goto('/login');
		} catch (err: unknown) {
			logoutError = getErrorMessage(err, 'log out');
		} finally {
			logoutLoading = false;
		}
	}
</script>

<div class="max-w-lg mx-auto px-unit-3 py-unit-3">
	<h2 class="text-h2 font-semibold text-text-primary mb-unit-3">Settings</h2>

	{#if loadError}
		<div class="card">
			<p class="text-danger text-sm mb-unit-2">{loadError}</p>
			{#if canRetry}
				<button
					onclick={loadData}
					class="bg-primary text-white rounded-card px-unit-3 py-1.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
				>
					Retry
				</button>
			{/if}
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

		<div class="card mt-unit-3">
			<h3 class="text-h3 font-semibold text-text-primary mb-unit-2">Account</h3>

			{#if logoutError}
				<p class="text-danger text-sm mb-unit-2">{logoutError}</p>
			{/if}

			<button
				type="button"
				onclick={handleLogout}
				disabled={logoutLoading}
				class="bg-danger text-white rounded-card px-unit-3 py-unit-1 font-medium text-base hover:opacity-90 disabled:opacity-60 transition-opacity"
			>
				{logoutLoading ? 'Logging out…' : 'Logout'}
			</button>
		</div>
	{/if}
</div>
