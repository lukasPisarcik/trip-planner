<script lang="ts">
	import { Dialog, Button, Input, Label } from '$lib/components';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import { ChevronDown, Check, Folder as FolderIcon } from '@lucide/svelte';
	import { saveReel } from '$lib/remote/reels.remote';
	import { toast } from '$lib';
	import type { ReelFolder } from '$lib/schemas';

	let {
		open,
		folders,
		onclose,
		onsaved
	}: {
		open: boolean;
		folders: ReelFolder[];
		onclose: () => void;
		/** Called with the new reel id after a successful save. */
		onsaved: (id: string) => void | Promise<void>;
	} = $props();

	let url = $state('');
	let folderId = $state<string | null>(null);
	let saving = $state(false);

	const selectedFolder = $derived(folders.find((f) => f.id === folderId) ?? null);

	// Reset the form whenever the dialog closes so it reopens clean.
	$effect(() => {
		if (!open) {
			url = '';
			folderId = null;
		}
	});

	async function confirm() {
		const trimmed = url.trim();
		if (!trimmed || saving) return;
		saving = true;
		try {
			const { id } = await saveReel({ url: trimmed, folderId });
			toast.success('Reel saved', { description: 'Extracting details in the background…' });
			await onsaved(id);
			onclose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to save reel');
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
				<Dialog.Title>Save a reel</Dialog.Title>
				<Dialog.Description>
					Paste a TikTok or Instagram link. We'll pull its details in the background.
				</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="reel-url">Link</Label>
					<Input
						id="reel-url"
						bind:value={url}
						placeholder="https://www.instagram.com/reel/…"
						type="url"
						autofocus
					/>
				</div>
				{#if folders.length > 0}
					<div class="grid gap-2">
						<Label>Folder</Label>
						<DropdownMenu>
							<DropdownMenuTrigger
								class="inline-flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent"
							>
								<span class="flex items-center gap-2 truncate">
									<FolderIcon class="size-4 shrink-0 opacity-70" />
									{selectedFolder ? selectedFolder.name : 'No folder'}
								</span>
								<ChevronDown class="size-4 shrink-0 opacity-60" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" class="min-w-[13rem]">
								<DropdownMenuItem class="cursor-pointer" onSelect={() => (folderId = null)}>
									No folder
									{#if folderId === null}<Check class="ml-auto size-4" />{/if}
								</DropdownMenuItem>
								{#each folders as f (f.id)}
									<DropdownMenuItem class="cursor-pointer" onSelect={() => (folderId = f.id)}>
										<FolderIcon class="size-4" />
										<span class="truncate">{f.name}</span>
										{#if folderId === f.id}<Check class="ml-auto size-4" />{/if}
									</DropdownMenuItem>
								{/each}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				{/if}
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={onclose} disabled={saving}>Cancel</Button>
				<Button type="submit" disabled={saving || !url.trim()}>
					{saving ? 'Saving…' : 'Save reel'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
