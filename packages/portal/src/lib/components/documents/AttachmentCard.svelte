<script lang="ts">
	import type { Attachment } from '$lib/api';

	interface Props {
		attachment: Attachment;
		onDelete: (attachment: Attachment) => void;
	}

	let { attachment, onDelete }: Props = $props();

	let showDeleteConfirm = $state(false);

	const categoryLabels: Record<string, string> = {
		lab_result: 'Lab Result',
		prescription: 'Prescription',
		insurance: 'Insurance',
		billing: 'Billing',
		imaging: 'Imaging',
		other: 'Other'
	};

	const categoryColors: Record<string, string> = {
		lab_result: 'bg-green-50 text-green-700 border-green-200',
		prescription: 'bg-blue-50 text-blue-700 border-blue-200',
		insurance: 'bg-purple-50 text-purple-700 border-purple-200',
		billing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
		imaging: 'bg-pink-50 text-pink-700 border-pink-200',
		other: 'bg-gray-50 text-gray-700 border-gray-200'
	};

	function isImage(url: string): boolean {
		const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
		const lowerUrl = url.toLowerCase();
		return imageExtensions.some((ext) => lowerUrl.includes(ext));
	}

	function getFilename(url: string): string {
		const parts = url.split('/');
		const filename = parts[parts.length - 1];
		// Remove UUID prefix if present (format: uuid-filename)
		const match = filename.match(/^[a-f0-9-]{36}-(.+)$/i);
		return match ? match[1] : filename;
	}

	function truncateFilename(filename: string, maxLength = 20): string {
		if (filename.length <= maxLength) return filename;
		const ext = filename.lastIndexOf('.');
		if (ext > 0 && filename.length - ext <= 5) {
			const name = filename.slice(0, ext);
			const extension = filename.slice(ext);
			const availableLength = maxLength - extension.length - 3;
			return name.slice(0, availableLength) + '...' + extension;
		}
		return filename.slice(0, maxLength - 3) + '...';
	}

	function handleDeleteClick(e: MouseEvent) {
		e.stopPropagation();
		showDeleteConfirm = true;
	}

	function handleConfirmDelete() {
		showDeleteConfirm = false;
		onDelete(attachment);
	}

	function handleCancelDelete() {
		showDeleteConfirm = false;
	}
</script>

<div class="relative border border-gray-200 rounded-card overflow-hidden bg-surface">
	<!-- Thumbnail / Preview -->
	<a
		href={attachment.file_url}
		target="_blank"
		rel="noopener noreferrer"
		class="block aspect-square bg-gray-100 flex items-center justify-center overflow-hidden"
	>
		{#if isImage(attachment.file_url)}
			<img
				src={attachment.file_url}
				alt={attachment.description ?? 'Attachment'}
				class="w-full h-full object-cover hover:opacity-90 transition-opacity"
			/>
		{:else}
			<!-- PDF / file icon -->
			<div class="flex flex-col items-center justify-center text-text-secondary p-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-10 h-10 text-red-500"
				>
					<path
						fill-rule="evenodd"
						d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM9.75 14.25a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5H9.75Z"
						clip-rule="evenodd"
					/>
					<path
						d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z"
					/>
				</svg>
				<span class="text-xs mt-1">PDF</span>
			</div>
		{/if}
	</a>

	<!-- Info section -->
	<div class="p-2">
		<!-- Description or filename -->
		<p class="text-sm text-text-primary truncate" title={attachment.description ?? getFilename(attachment.file_url)}>
			{attachment.description ?? truncateFilename(getFilename(attachment.file_url))}
		</p>

		<!-- Category badge and delete button row -->
		<div class="flex items-center justify-between mt-1.5">
			<span
				class="text-xs px-2 py-0.5 rounded-full border {categoryColors[attachment.category] ??
					categoryColors.other}"
			>
				{categoryLabels[attachment.category] ?? 'Other'}
			</span>

			<button
				onclick={handleDeleteClick}
				class="p-1 rounded hover:bg-red-50 transition-colors"
				aria-label="Delete attachment"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="w-4 h-4 text-gray-400 hover:text-danger"
				>
					<path
						fill-rule="evenodd"
						d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>

<!-- Delete confirmation popup -->
{#if showDeleteConfirm}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-unit-2"
		role="dialog"
		aria-modal="true"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) handleCancelDelete();
		}}
	>
		<div class="card w-full max-w-sm">
			<h3 class="text-h3 font-semibold text-text-primary mb-unit-2">Delete Attachment?</h3>
			<p class="text-sm text-text-secondary mb-unit-3">
				Are you sure you want to delete this attachment? This cannot be undone.
			</p>
			<div class="flex gap-unit-2 justify-end">
				<button
					onclick={handleCancelDelete}
					class="px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary
					       hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleConfirmDelete}
					class="px-unit-3 py-2 rounded-card bg-danger text-white font-semibold text-base
					       hover:bg-red-600 transition-colors"
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}
