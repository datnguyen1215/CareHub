<script lang="ts">
	import { uploadFile } from '$lib/api';
	import { getInitial } from '$lib/utils/format';

	interface Props {
		currentUrl?: string | null;
		name?: string;
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		onUpload: (url: string) => void;
	}

	let {
		currentUrl = null,
		name = '',
		size = 'md',
		disabled = false,
		onUpload
	}: Props = $props();

	let loading = $state(false);
	let error = $state('');
	let fileInput: HTMLInputElement;

	const sizeClasses = {
		sm: 'w-12 h-12 text-lg',
		md: 'w-20 h-20 text-2xl',
		lg: 'w-24 h-24 text-3xl'
	};

	const iconSizes = {
		sm: 'w-4 h-4',
		md: 'w-5 h-5',
		lg: 'w-6 h-6'
	};

	function handleClick() {
		if (!disabled && !loading) {
			fileInput?.click();
		}
	}

	async function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			error = 'Please select a JPEG, PNG, GIF, or WebP image.';
			return;
		}

		// Validate file size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be less than 5MB.';
			return;
		}

		loading = true;
		error = '';

		try {
			const url = await uploadFile(file);
			onUpload(url);
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Failed to upload image.';
		} finally {
			loading = false;
			// Reset input so same file can be selected again
			input.value = '';
		}
	}
</script>

<div class="flex flex-col items-center gap-2">
	<button
		type="button"
		onclick={handleClick}
		disabled={disabled || loading}
		class="relative rounded-full bg-gray-200 flex items-center justify-center overflow-hidden
		       hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
		       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
		       {sizeClasses[size]}"
		aria-label={currentUrl ? 'Change photo' : 'Add photo'}
	>
		{#if currentUrl}
			<img src={currentUrl} alt="" class="w-full h-full object-cover" />
		{:else}
			<span class="text-gray-500 font-semibold">{getInitial(name)}</span>
		{/if}

		<!-- Camera overlay -->
		<div
			class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0
			       hover:opacity-100 transition-opacity"
			class:opacity-100={loading}
		>
			{#if loading}
				<svg
					class="animate-spin text-white {iconSizes[size]}"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="text-white {iconSizes[size]}"
				>
					<path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
					<path
						fill-rule="evenodd"
						d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3H4.5a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.152-.177a1.56 1.56 0 0 0 1.11-.71l.821-1.317a2.685 2.685 0 0 1 2.332-1.39ZM12 12.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"
						clip-rule="evenodd"
					/>
				</svg>
			{/if}
		</div>
	</button>

	{#if error}
		<p class="text-xs text-danger text-center max-w-[200px]">{error}</p>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/gif,image/webp"
		class="hidden"
		onchange={handleFileChange}
	/>
</div>
