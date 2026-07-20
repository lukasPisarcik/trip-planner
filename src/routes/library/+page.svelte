<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import type { Reel, ReelFolder } from '$lib/schemas';
	import { reelSelectionStore } from '$lib/stores';
	import { moveReelToFolder, deleteReel, retryReelExtraction } from '$lib/remote/reels.remote';
	import { toast } from '$lib';
	import { Button, Skeleton, Dialog } from '$lib/components';
	import { Plus, Sparkles, Pencil, Trash2, MoreHorizontal } from '@lucide/svelte';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import ReelTile from '$lib/components/library/ReelTile.svelte';
	import SaveReelDialog from '$lib/components/library/SaveReelDialog.svelte';
	import ReelFolderDialogs from '$lib/components/library/ReelFolderDialogs.svelte';

	const viewerMode = $derived(page.data.viewerMode ?? false);

	// Reactive reads — the grid live-updates as reels finish processing or move.
	const reelsQuery = useQuery(api.reels.listReels, {});
	const reels = $derived<Reel[]>((reelsQuery.data ?? []) as Reel[]);
	const loading = $derived(reelsQuery.isLoading);

	const foldersQuery = useQuery(api.reels.listReelFolders, {});
	const folders = $derived<ReelFolder[]>((foldersQuery.data ?? []) as ReelFolder[]);
	const folderIdSet = $derived(new Set(folders.map((f) => f.id)));

	// Grouped by folder + the ungrouped remainder (mirrors the sidebar trip grouping).
	const foldersWithReels = $derived(
		folders.map((f) => ({ folder: f, reels: reels.filter((r) => r.folderId === f.id) }))
	);
	const ungrouped = $derived(reels.filter((r) => !r.folderId || !folderIdSet.has(r.folderId)));

	const selectionCount = $derived(reelSelectionStore.count);

	// Dialog + handoff state.
	let saveOpen = $state(false);
	let createFolderOpen = $state(false);
	let renameTarget = $state<ReelFolder | null>(null);
	let deleteFolderTarget = $state<ReelFolder | null>(null);
	let deleteReelTarget = $state<Reel | null>(null);
	// A reel awaiting a move when "New folder…" is chosen from its move submenu.
	let pendingFolderReel = $state<Reel | null>(null);

	// --- Reel actions --------------------------------------------------------
	async function onmove(reel: Reel, folderId: string | null) {
		try {
			await moveReelToFolder({ id: reel.id, folderId });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to move reel');
		}
	}
	async function onretry(reel: Reel) {
		try {
			await retryReelExtraction({ id: reel.id });
			toast.success('Retrying extraction…');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to retry');
		}
	}
	function onnewfolder(reel: Reel) {
		pendingFolderReel = reel;
		createFolderOpen = true;
	}
	async function confirmDeleteReel() {
		const reel = deleteReelTarget;
		if (!reel) return;
		try {
			await deleteReel({ id: reel.id });
			if (reelSelectionStore.isSelected(reel.id)) reelSelectionStore.toggle(reel.id); // drop from selection
			toast.success('Reel deleted');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete reel');
		} finally {
			deleteReelTarget = null;
		}
	}

	// --- Folder dialog wiring ------------------------------------------------
	function closeCreateFolder() {
		createFolderOpen = false;
		pendingFolderReel = null;
	}
	async function onFolderCreated(id: string) {
		if (pendingFolderReel) {
			const reel = pendingFolderReel;
			pendingFolderReel = null;
			await moveReelToFolder({ id: reel.id, folderId: id });
		}
	}

	// --- Build trip handoff --------------------------------------------------
	// Move the current selection into the pending handoff, then open the co-pilot
	// workspace; the composer drains `takePending()` on mount and renders the reels
	// as attachment chips.
	async function buildTrip() {
		if (selectionCount === 0) return;
		reelSelectionStore.handoff();
		await goto(resolve('/agent'));
	}
</script>

<svelte:head>
	<title>Library · Trip Planner</title>
</svelte:head>

<div
	class="mx-auto max-w-[1200px] px-10 pt-14 pb-16 max-[700px]:px-5 max-[700px]:pt-8 max-[700px]:pb-12"
>
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<div class="text-[11px] font-semibold tracking-[0.16em] text-(--ink3) uppercase">Library</div>
		<div class="ml-auto flex items-center gap-2">
			{#if !viewerMode}
				<Button
					variant="secondary"
					disabled={selectionCount === 0}
					onclick={buildTrip}
					title="Build a trip from the selected reels"
				>
					<Sparkles class="size-4" />
					Build trip{selectionCount > 0 ? ` (${selectionCount})` : ''}
				</Button>
				<Button onclick={() => (saveOpen = true)}>
					<Plus class="size-4" />
					Save reel
				</Button>
			{/if}
		</div>
	</div>

	{#if loading}
		<!-- Skeleton grid while the first read resolves. -->
		<div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
			{#each Array.from({ length: 8 }) as _, i (i)}
				<Skeleton class="aspect-[9/16] rounded-[12px]" />
			{/each}
		</div>
	{:else if reels.length === 0}
		<!-- Empty state -->
		<div
			class="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-(--trip-border) px-6 py-16 text-center"
		>
			<div class="text-[40px] leading-none">🎬</div>
			<h2 class="font-serif text-2xl text-(--ink)">No saved reels yet</h2>
			<p class="max-w-md text-sm text-(--ink2)">
				Paste a TikTok or Instagram link to save it here, then select a few and build a trip from
				them.
			</p>
			{#if !viewerMode}
				<Button class="mt-1" onclick={() => (saveOpen = true)}>
					<Plus class="size-4" />
					Save your first reel
				</Button>
			{/if}
		</div>
	{:else}
		<div class="flex flex-col gap-10">
			{#each foldersWithReels as { folder, reels: fr } (folder.id)}
				{#if fr.length > 0 || !viewerMode}
					<section class="flex flex-col gap-3">
						<div class="group/folder flex items-center gap-2">
							<h2 class="text-[13px] font-semibold text-(--ink)">{folder.name}</h2>
							<span class="text-[12px] text-(--ink3)">{fr.length}</span>
							{#if !viewerMode}
								<DropdownMenu>
									<DropdownMenuTrigger>
										{#snippet child({ props })}
											<button
												{...props}
												class="ml-1 inline-flex size-6 items-center justify-center rounded-md text-(--ink3) opacity-0 transition-opacity group-hover/folder:opacity-100 hover:bg-(--cream) hover:text-(--ink) focus-visible:opacity-100"
												title="Folder options"
												aria-label="Folder options"
											>
												<MoreHorizontal class="size-4" />
											</button>
										{/snippet}
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" class="w-40">
										<DropdownMenuItem
											class="cursor-pointer"
											onSelect={() => (renameTarget = folder)}
										>
											<Pencil class="size-4" />
											Rename
										</DropdownMenuItem>
										<DropdownMenuItem
											variant="destructive"
											class="cursor-pointer"
											onSelect={() => (deleteFolderTarget = folder)}
										>
											<Trash2 class="size-4" />
											Delete folder
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							{/if}
						</div>
						{#if fr.length > 0}
							<div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
								{#each fr as reel (reel.id)}
									<ReelTile
										{reel}
										{folders}
										{viewerMode}
										ondelete={(r) => (deleteReelTarget = r)}
										{onmove}
										{onretry}
										{onnewfolder}
									/>
								{/each}
							</div>
						{:else}
							<p class="text-[12px] text-(--ink3)">Empty folder.</p>
						{/if}
					</section>
				{/if}
			{/each}

			{#if ungrouped.length > 0}
				<section class="flex flex-col gap-3">
					{#if folders.length > 0}
						<h2 class="text-[13px] font-semibold text-(--ink)">Ungrouped</h2>
					{/if}
					<div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
						{#each ungrouped as reel (reel.id)}
							<ReelTile
								{reel}
								{folders}
								{viewerMode}
								ondelete={(r) => (deleteReelTarget = r)}
								{onmove}
								{onretry}
								{onnewfolder}
							/>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	{/if}
</div>

{#if !viewerMode}
	<SaveReelDialog open={saveOpen} {folders} onclose={() => (saveOpen = false)} onsaved={() => {}} />
	<ReelFolderDialogs
		createOpen={createFolderOpen}
		onCreateClose={closeCreateFolder}
		oncreated={onFolderCreated}
		{renameTarget}
		onRenameClose={() => (renameTarget = null)}
		deleteTarget={deleteFolderTarget}
		onDeleteClose={() => (deleteFolderTarget = null)}
		ondeleted={() => {}}
	/>
	<Dialog.Root
		open={deleteReelTarget !== null}
		onOpenChange={(o) => {
			if (!o) deleteReelTarget = null;
		}}
	>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Delete this reel?</Dialog.Title>
				<Dialog.Description>
					It will be removed from your library. This can't be undone.
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (deleteReelTarget = null)}>Cancel</Button>
				<Button variant="destructive" onclick={confirmDeleteReel}>Delete reel</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
