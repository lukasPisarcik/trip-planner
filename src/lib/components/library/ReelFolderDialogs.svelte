<script lang="ts">
	import { Dialog, Button, Input, Label } from '$lib/components';
	import { createReelFolder, renameReelFolder, deleteReelFolder } from '$lib/remote/reels.remote';
	import { toast } from '$lib';
	import type { ReelFolder } from '$lib/schemas';

	let {
		createOpen,
		onCreateClose,
		oncreated,
		renameTarget,
		onRenameClose,
		deleteTarget,
		onDeleteClose,
		ondeleted
	}: {
		createOpen: boolean;
		onCreateClose: () => void;
		/** Called with the new folder id after a successful create. */
		oncreated: (id: string) => void | Promise<void>;
		renameTarget: ReelFolder | null;
		onRenameClose: () => void;
		deleteTarget: ReelFolder | null;
		onDeleteClose: () => void;
		ondeleted: (id: string) => void | Promise<void>;
	} = $props();

	let createName = $state('');
	let creating = $state(false);
	let renameName = $state('');
	let renaming = $state(false);
	let deleting = $state(false);

	$effect(() => {
		if (!createOpen) createName = '';
	});
	$effect(() => {
		if (renameTarget) renameName = renameTarget.name;
	});

	async function confirmCreate() {
		const trimmed = createName.trim();
		if (!trimmed || creating) return;
		creating = true;
		try {
			const { id } = await createReelFolder({ name: trimmed });
			toast.success('Folder created');
			await oncreated(id);
			onCreateClose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to create folder');
		} finally {
			creating = false;
		}
	}

	async function confirmRename() {
		if (!renameTarget) return;
		const trimmed = renameName.trim();
		if (!trimmed || renaming) return;
		renaming = true;
		try {
			await renameReelFolder({ id: renameTarget.id, name: trimmed });
			toast.success('Folder renamed');
			onRenameClose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to rename folder');
		} finally {
			renaming = false;
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		const id = deleteTarget.id;
		deleting = true;
		try {
			await deleteReelFolder({ id });
			toast.success('Folder deleted');
			await ondeleted(id);
			onDeleteClose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete folder');
		} finally {
			deleting = false;
		}
	}
</script>

<!-- Create -->
<Dialog.Root
	open={createOpen}
	onOpenChange={(o) => {
		if (!o) onCreateClose();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				confirmCreate();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>New folder</Dialog.Title>
				<Dialog.Description>Group saved reels together in your library.</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-2 py-4">
				<Label for="reel-folder-name">Name</Label>
				<Input
					id="reel-folder-name"
					bind:value={createName}
					placeholder="e.g. Tokyo eats"
					maxlength={60}
					autofocus
				/>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={onCreateClose} disabled={creating}>
					Cancel
				</Button>
				<Button type="submit" disabled={creating || !createName.trim()}>
					{creating ? 'Creating…' : 'Create folder'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Rename -->
<Dialog.Root
	open={renameTarget !== null}
	onOpenChange={(o) => {
		if (!o) onRenameClose();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				confirmRename();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Rename folder</Dialog.Title>
			</Dialog.Header>
			<div class="grid gap-2 py-4">
				<Label for="rename-reel-folder-name">Name</Label>
				<Input id="rename-reel-folder-name" bind:value={renameName} maxlength={60} autofocus />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={onRenameClose} disabled={renaming}>
					Cancel
				</Button>
				<Button type="submit" disabled={renaming || !renameName.trim()}>
					{renaming ? 'Saving…' : 'Save'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete -->
<Dialog.Root
	open={deleteTarget !== null}
	onOpenChange={(o) => {
		if (!o) onDeleteClose();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete {deleteTarget?.name ?? 'folder'}?</Dialog.Title>
			<Dialog.Description>
				The folder will be removed and its reels moved to Ungrouped. This can't be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={onDeleteClose} disabled={deleting}>Cancel</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={deleting}>
				{deleting ? 'Deleting…' : 'Delete folder'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
