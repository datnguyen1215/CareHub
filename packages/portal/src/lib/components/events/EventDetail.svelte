<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getEvent,
		deleteEvent,
		listAttachments,
		deleteAttachment,
		type Event,
		type Attachment
	} from '$lib/api';
	import { createFocusTrap } from '$lib/utils/focusTrap';
	import AttachmentCard from '$lib/components/documents/AttachmentCard.svelte';
	import AttachmentUpload from '$lib/components/documents/AttachmentUpload.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { EVENT_TYPE_LABELS } from '$lib/utils/categories';