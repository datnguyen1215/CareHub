<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getJournalEntry,
		deleteJournalEntry,
		listAttachments,
		deleteAttachment,
		type JournalEntry,
		type Attachment
	} from '$lib/api';
	import { createFocusTrap } from '$lib/utils/focusTrap';
	import AttachmentCard from '$lib/components/documents/AttachmentCard.svelte';
	import AttachmentUpload from '$lib/components/documents/AttachmentUpload.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatDateLong } from '$lib/utils/format';