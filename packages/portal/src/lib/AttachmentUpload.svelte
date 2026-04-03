<script lang="ts">
	import { uploadAttachment, type Attachment, type AttachmentCategory } from './api';
	import { toast } from './stores/toast';

	interface Props {
		profileId: string;
		journalId?: string;
		eventId?: string;
		onUploaded: (attachment: Attachment) => void;
	}

	let { profileId, journalId, eventId, onUploaded }: Props = $props();

	let showActionSheet = $state(false);
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let error = $state('');
	let cameraInput: HTMLInputElement;
	let fileInput: HTMLInputElement;

	// Category selection state
	let showCategorySelect = $state(false);
	let selectedFile = $state<File | null>(null);
	let selectedCategory = $state<AttachmentCategory>('other');

	const categories: { value: AttachmentCategory; label: string }[] = [
		{ value: 'lab_result', label: 'Lab Result' },
		{ value: 'prescription', label: 'Prescription' },
		{ value: 'insurance', label: 'Insurance' },
		{ value: 'billing', label: 'Billing' },
		{ value: 'imaging', label: 'Imaging' },
		{ value: 'other', label: 'Other' }
	];

	function handleAddClick() {
		error = '';
		showActionSheet = true;
	}

	function handleTakePhoto() {
		showActionSheet = false;
		cameraInput?.click();
	}

	function handleChooseFile() {
		showActionSheet = false;
		fileInput?.click();
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
		if (!allowedTypes.includes(file.type)) {
			error = 'Invalid file type. Only images and PDFs are allowed.';
			input.value = '';
			return;
		}

		// Validate file size (10MB)
		if (file.size > 10 * 1024 * 1024) {
			error = 'File too large. Maximum size is 10MB.';
			input.value = '';
			return;
		}

		// Store file and show category selector
		selectedFile = file;
		selectedCategory = 'other';
		showCategorySelect = true;
		input.value = '';
	}

	async function handleUpload() {
		if (!selectedFile) return;

		error = '';
		uploading = true;
		uploadProgress = 0;

		// Simulate progress (actual progress would require XHR)
		const progressInterval = setInterval(() => {
			uploadProgress = Math.min(uploadProgress + 10, 90);
		}, 100);

		try {
			const attachment = await uploadAttachment(profileId, selectedFile, selectedCategory, {
				journal_id: journalId,
				event_id: eventId
			});
			uploadProgress = 100;
			onUploaded(attachment);
			toast.success('Attachment uploaded');
			showCategorySelect = false;
			selectedFile = null;
				error = '';
		} catch (err: unknown) {
			const apiErr = err as { message?: string };
			error = apiErr?.message ?? 'Failed to upload attachment';
		} finally {
			clearInterval(progressInterval);
			uploading = false;
			uploadProgress = 0;
		}
	}

	function handleCancelUpload() {
		showCategorySelect = false;
		selectedFile = null;
		error = '';
	}

	function closeActionSheet() {
		showActionSheet = false;
	}
</script>

<!-- Hidden file inputs -->
<input
	bind:this={cameraInput}
	type="file"
	accept="image/*"
	capture="environment"
	class="hidden"
	onchange={handleFileSelect}
/>
<input
	bind:this={fileInput}
	type="file"
	accept="image/*,.pdf,application/pdf"
	class="hidden"
	onchange={handleFileSelect}
/>

<!-- Add button -->
<button
	onclick={handleAddClick}
	disabled={uploading}
	class="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline disabled:opacity-50"
>
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
		<path
			d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"
		/>
	</svg>
	Add
</button>

{#if error}
	<p class="text-sm text-danger mt-1">{error}</p>
{/if}

<!-- Upload progress indicator -->
{#if uploading}
	<div class="mt-2">
		<div class="flex items-center gap-2">
			<div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
				<div
					class="h-full bg-primary transition-all duration-200"
					style="width: {uploadProgress}%"
				></div>
			</div>
			<span class="text-xs text-text-secondary">{uploadProgress}%</span>
		</div>
	</div>
{/if}

<!-- Action sheet for choosing upload method -->
{#if showActionSheet}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
		role="dialog"
		aria-modal="true"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) closeActionSheet();
		}}
	>
		<div class="w-full max-w-md bg-surface rounded-t-2xl p-unit-2 pb-8 animate-slide-up">
			<div class="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-unit-3"></div>
			<h3 class="text-h3 font-semibold text-text-primary text-center mb-unit-3">Add Attachment</h3>

			<div class="flex flex-col gap-unit-1">
				<button
					onclick={handleTakePhoto}
					class="flex items-center gap-3 w-full p-4 rounded-card hover:bg-gray-50 transition-colors text-left"
				>
					<div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-5 h-5 text-primary"
						>
							<path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
							<path
								fill-rule="evenodd"
								d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3H4.5a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.152-.177a1.56 1.56 0 0 0 1.11-.71l.821-1.317a2.685 2.685 0 0 1 2.332-1.39ZM12 12.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div>
						<p class="font-semibold text-text-primary">Take Photo</p>
						<p class="text-sm text-text-secondary">Use camera to capture</p>
					</div>
				</button>

				<button
					onclick={handleChooseFile}
					class="flex items-center gap-3 w-full p-4 rounded-card hover:bg-gray-50 transition-colors text-left"
				>
					<div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-5 h-5 text-green-600"
						>
							<path
								fill-rule="evenodd"
								d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V12Z"
								clip-rule="evenodd"
							/>
							<path
								d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z"
							/>
						</svg>
					</div>
					<div>
						<p class="font-semibold text-text-primary">Choose File</p>
						<p class="text-sm text-text-secondary">Select image or PDF</p>
					</div>
				</button>
			</div>

			<button
				onclick={closeActionSheet}
				class="w-full mt-unit-3 p-3 rounded-card border border-gray-300 text-text-primary font-semibold
				       hover:bg-gray-50 transition-colors"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}

<!-- Category selection modal -->
{#if showCategorySelect}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-unit-2"
		role="dialog"
		aria-modal="true"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) handleCancelUpload();
		}}
	>
		<div class="card w-full max-w-sm">
			<h3 class="text-h3 font-semibold text-text-primary mb-unit-2">Select Category</h3>
			<p class="text-sm text-text-secondary mb-unit-3">
				Choose a category for "{selectedFile?.name}"
			</p>

			{#if error}
				<div class="mb-unit-3 p-unit-2 bg-red-50 border border-red-200 rounded-card">
					<p class="text-sm text-danger">{error}</p>
				</div>
			{/if}

			<div class="flex flex-col gap-unit-1 mb-unit-3">
				{#each categories as cat}
					<button
						onclick={() => (selectedCategory = cat.value)}
						class="flex items-center gap-2 p-3 rounded-card border transition-colors text-left
						       {selectedCategory === cat.value
							? 'border-primary bg-blue-50'
							: 'border-gray-200 hover:border-gray-300'}"
					>
						<div
							class="w-4 h-4 rounded-full border-2 flex items-center justify-center
							       {selectedCategory === cat.value ? 'border-primary' : 'border-gray-300'}"
						>
							{#if selectedCategory === cat.value}
								<div class="w-2 h-2 rounded-full bg-primary"></div>
							{/if}
						</div>
						<span class="text-text-primary">{cat.label}</span>
					</button>
				{/each}
			</div>

			<div class="flex gap-unit-2 justify-end">
				<button
					onclick={handleCancelUpload}
					disabled={uploading}
					class="px-unit-3 py-2 rounded-card border border-gray-300 text-base text-text-primary
					       hover:bg-gray-50 disabled:opacity-50 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleUpload}
					disabled={uploading}
					class="px-unit-3 py-2 rounded-card bg-primary text-white font-semibold text-base
					       hover:bg-blue-600 disabled:opacity-50 transition-colors"
				>
					{uploading ? 'Uploading...' : error ? 'Retry' : 'Upload'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.animate-slide-up {
		animation: slide-up 0.2s ease-out;
	}
</style>
