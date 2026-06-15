<script lang="ts">
	import { Dialog, Button } from '$lib/components';
	import { deleteFolder } from '$lib/remote/folders.remote';
	import { toast } from '$lib';
	import type { Folder } from '$lib/schemas';

	let {
		folder,
		onclose,
		ondeleted
	}: {
		/** The folder pending deletion, or `null` when the dialog is closed. */
		folder: Folder | null;
		onclose: () => void;
		ondeleted: (id: string) => void | Promise<void>;
	} = $props();

	let deleting = $state(false);

	async function confirm() {
		if (!folder) return;
		const id = folder.id;
		deleting = true;
		try {
			await deleteFolder({ id });
			toast.success('Folder deleted');
			await ondeleted(id);
			onclose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete folder');
		} finally {
			deleting = false;
		}
	}
</script>

<Dialog.Root
	open={folder !== null}
	onOpenChange={(o) => {
		if (!o) onclose();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete {folder?.name ?? 'folder'}?</Dialog.Title>
			<Dialog.Description>
				The folder will be removed and its trips moved to Ungrouped. This can't be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={onclose} disabled={deleting}>Cancel</Button>
			<Button variant="destructive" onclick={confirm} disabled={deleting}>
				{deleting ? 'Deleting…' : 'Delete folder'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
