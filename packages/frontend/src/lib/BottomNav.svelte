<script lang="ts">
	import { page } from '$app/stores';

	const tabs = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/profiles', label: 'Profiles', icon: 'profiles' },
		{ href: '/devices', label: 'Devices', icon: 'devices' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	] as const;

	function isActive(href: string) {
		if (href === '/') return $page.url.pathname === '/';
		return $page.url.pathname.startsWith(href);
	}
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-200 z-50">
	<div class="max-w-2xl mx-auto flex">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs font-medium transition-colors min-h-[44px]
					{isActive(tab.href) ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}"
				aria-current={isActive(tab.href) ? 'page' : undefined}
			>
				{#if tab.icon === 'home'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6"
						aria-hidden="true"
					>
						<path
							d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z"
						/>
						<path
							d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z"
						/>
					</svg>
				{:else if tab.icon === 'profiles'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-1.49-.156 5.25 5.25 0 0 0-10.438 0 .75.75 0 0 1-1.49.157 6.745 6.745 0 0 1 .019-.482ZM19.5 13.875a.75.75 0 0 1 .75.75v1.875h1.875a.75.75 0 0 1 0 1.5H20.25v1.875a.75.75 0 0 1-1.5 0V18h-1.875a.75.75 0 0 1 0-1.5h1.875v-1.875a.75.75 0 0 1 .75-.75Z"
							clip-rule="evenodd"
						/>
					</svg>
				{:else if tab.icon === 'devices'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6"
						aria-hidden="true"
					>
						<path d="M10.5 18.75a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" />
						<path
							fill-rule="evenodd"
							d="M8.25 6.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM6 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 1.5A.5.5 0 0 0 7.5 5v14a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V5a.5.5 0 0 0-.5-.5H8Z"
							clip-rule="evenodd"
						/>
					</svg>
				{:else if tab.icon === 'settings'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
				{tab.label}
			</a>
		{/each}
	</div>
</nav>

<!-- Spacer to prevent content from being hidden behind the fixed nav -->
<div class="h-16"></div>
