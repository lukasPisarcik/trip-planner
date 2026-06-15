<script lang="ts">
	import { Dialog, Button, Input, Label } from '$lib/components';
	import { createFolder } from '$lib/remote/folders.remote';
	import { toast } from '$lib';

	let {
		open,
		onclose,
		oncreated
	}: {
		open: boolean;
		onclose: () => void;
		/** Called with the new folder id after a successful create. */
		oncreated: (id: string) => void | Promise<void>;
	} = $props();

	let name = $state('');
	let saving = $state(false);

	// Reset the field whenever the dialog is closed so it reopens empty.
	$effect(() => {
		if (!open) name = '';
	});

	async function confirm() {
		const trimmed = name.trim();
		if (!trimmed || saving) return;
		saving = true;
		try {
			const { id } = await createFolder({ name: trimmed });
			toast.success('Folder created');
			await oncreated(id);
			onclose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to create folder');
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root
	{open}
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
				<Dialog.Title>New folder</Dialog.Title>
				<Dialog.Description>Group trips together in the sidebar.</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-2 py-4">
				<Label for="folder-name">Name</Label>
				<Input
					id="folder-name"
					bind:value={name}
					placeholder="e.g. Road trips"
					maxlength={60}
					autofocus
				/>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={onclose} disabled={saving}>Cancel</Button>
				<Button type="submit" disabled={saving || !name.trim()}>
					{saving ? 'Creating…' : 'Create folder'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
