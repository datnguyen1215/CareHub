<script lang="ts">
	import {
		createJournalEntry,
		updateJournalEntry,
		type JournalEntry,
		type CreateJournalEntryInput
	} from '$lib/api';
	import JournalTab from '$lib/components/journal/JournalTab.svelte';
	import JournalEntryModal from '$lib/components/journal/JournalEntryModal.svelte';
	import JournalEntryDetail from '$lib/components/journal/JournalEntryDetail.svelte';

	interface Props {
		profileId: string;
		initialEntryId?: string | null;
		onInitialIdConsumed?: () => void;
	}

	let { profileId, initialEntryId = null, onInitialIdConsumed }: Props = $props();

	// Journal state
	let showJournalModal = $state(false);
	let editingJournalEntry = $state<JournalEntry | null>(null);
	let journalTabKey = $state(0);
	let viewingJournalEntryId = $state<string | null>(null);

	// Consume initialEntryId once — only react to changes in the prop itself
	$effect(() => {
		if (initialEntryId) {
			viewingJournalEntryId = initialEntryId;
			onInitialIdConsumed?.();
		}
	});

	function openCreateJournal() {
		editingJournalEntry = null;
		showJournalModal = true;
	}

	function openEditJournal(entry: JournalEntry) {
		editingJournalEntry = entry;
		showJournalModal = true;
		viewingJournalEntryId = null;
	}

	function closeJournalModal() {
		showJournalModal = false;
		editingJournalEntry = null;
	}

	async function handleJournalSave(data: CreateJournalEntryInput) {
		if (editingJournalEntry) {
			await updateJournalEntry(profileId, editingJournalEntry.id, data);
		} else {
			await createJournalEntry(profileId, data);
		}

		closeJournalModal();
		journalTabKey += 1;
	}

	function handleJournalEntryClick(entry: JournalEntry) {
		viewingJournalEntryId = entry.id;
	}

	function handleJournalDeleted() {
		viewingJournalEntryId = null;
		journalTabKey += 1;
	}
</script>

{#key journalTabKey}
	<JournalTab
		{profileId}
		onEntryClick={handleJournalEntryClick}
		onAddClick={openCreateJournal}
	/>
{/key}

{#if showJournalModal}
	<JournalEntryModal
		entry={editingJournalEntry}
		onSave={handleJournalSave}
		onClose={closeJournalModal}
	/>
{/if}

{#if viewingJournalEntryId}
	<JournalEntryDetail
		{profileId}
		entryId={viewingJournalEntryId}
		onClose={() => (viewingJournalEntryId = null)}
		onEdit={openEditJournal}
		onDeleted={handleJournalDeleted}
	/>
{/if}
