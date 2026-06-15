<script lang="ts">
	import { Dialog, Button, Input, Label } from '$lib/components';
	import { renameFolder } from '$lib/remote/folders.remote';
	import { toast } from '$lib';
	import type { Folder } from '$lib/schemas';

	let {
		folder,
		onclose,
		onrenamed
	}: {
		/** The folder being renamed, or `null` when the dialog is closed. */
		folder: Folder | null;
		onclose: () => void;
		onrenamed: () => void | Promise<void>;
	} = $props();

	let name = $state('');
	let saving = $state(false);

	// Prefill with the current name each time a folder is selected.
	$effect(() => {
		if (folder) name = folder.name;
	});

	async function confirm() {
		if (!folder) return;
		const trimmed = name.trim();
		if (!trimmed || saving) return;
		saving = true;
		try {
			await renameFolder({ id: folder.id, name: trimmed });
			toast.success('Folder renamed');
			await onrenamed();
			onclose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to rename folder');
		} finally {
			saving = false;
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
		<form
			onsubmit={(e) => {
				e.preventDefault();
				confirm();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Rename folder</Dialog.Title>
			</Dialog.Header>
			<div class="grid gap-2 py-4">
				<Label for="rename-folder-name">Name</Label>
				<Input id="rename-folder-name" bind:value={name} maxlength={60} autofocus />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={onclose} disabled={saving}>Cancel</Button>
				<Button type="submit" disabled={saving || !name.trim()}>
					{saving ? 'Saving…' : 'Save'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
