<script lang="ts">
	import { MAX_REEL_ATTACHMENTS, type Reel, type ReelFolder } from '$lib/schemas';
	import { Checkbox } from '$lib/components';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuSub,
		DropdownMenuSubTrigger,
		DropdownMenuSubContent
	} from '$lib/components/ui/dropdown-menu';
	import { reelSelectionStore } from '$lib/stores';
	import {
		ExternalLink,
		MoreHorizontal,
		Trash2,
		FolderInput,
		Folder as FolderIcon,
		FolderPlus,
		RotateCw,
		Loader2
	} from '@lucide/svelte';

	let {
		reel,
		folders,
		viewerMode,
		ondelete,
		onmove,
		onretry,
		onnewfolder
	}: {
		reel: Reel;
		folders: ReelFolder[];
		viewerMode: boolean;
		ondelete: (reel: Reel) => void;
		onmove: (reel: Reel, folderId: string | null) => void;
		onretry: (reel: Reel) => void;
		/** Open the "new folder" dialog, remembering this reel as the move target. */
		onnewfolder: (reel: Reel) => void;
	} = $props();

	const platformMeta: Record<Reel['platform'], { icon: string; label: string; tone: string }> = {
		tiktok: {
			icon: '🎵',
			label: 'TikTok',
			tone: 'border-(--fire-md) bg-(--fire-lt) text-(--fire)'
		},
		instagram: {
			icon: '📸',
			label: 'Instagram',
			tone: 'border-(--rose-md) bg-(--rose-lt) text-(--rose)'
		}
	};
	const platform = $derived(platformMeta[reel.platform]);

	const statusMeta: Record<Reel['status'], { label: string; tone: string }> = {
		processing: { label: 'Processing', tone: 'border-(--amber-md) bg-(--amber-lt) text-(--amber)' },
		ready: { label: 'Ready', tone: 'border-(--sage-md) bg-(--sage-lt) text-(--sage)' },
		error: { label: 'Failed', tone: 'border-(--fire-md) bg-(--fire-lt) text-(--fire)' }
	};
	const status = $derived(statusMeta[reel.status]);

	const selected = $derived(reelSelectionStore.isSelected(reel.id));

	// Broken/absent thumbnails fall back to a platform-tinted placeholder.
	let broken = $state(false);
	const showImage = $derived(!!reel.thumbnailUrl && !broken);

	// A short human label for the tile (author > caption > platform).
	const label = $derived(
		reel.author?.trim() ||
			(reel.caption?.trim() ? reel.caption.trim().slice(0, 60) : '') ||
			platform.label
	);
</script>

<div
	class="group relative flex flex-col overflow-hidden rounded-[12px] border border-(--trip-border) bg-(--white) transition-[box-shadow,transform] duration-200 ease-[ease] hover:-translate-y-0.5 hover:shadow-(--trip-shadow) {selected
		? 'ring-2 ring-(--fire) ring-offset-1'
		: ''}"
>
	<!-- Thumbnail (portrait, reel aspect) -->
	<div class="relative aspect-[9/16] overflow-hidden bg-(--cream)">
		{#if showImage}
			<img
				class="block h-full w-full object-cover"
				src={reel.thumbnailUrl}
				alt={label}
				loading="lazy"
				onerror={() => (broken = true)}
			/>
		{:else}
			<div class="flex h-full w-full items-center justify-center text-[40px] opacity-40">
				{platform.icon}
			</div>
		{/if}

		<!-- Select checkbox (top-left) — selection feeds the write-only Build-trip flow,
		     so it's hidden in viewer mode alongside the other write affordances.
		     Disabled once the per-build attachment cap is reached (unless already
		     picked), so the limit is visible here rather than as an opaque 400 later. -->
		{#if !viewerMode}
			{@const capped = !selected && reelSelectionStore.atLimit}
			<div
				class="absolute top-2 left-2 z-2 rounded-md bg-(--white)/85 p-0.5 backdrop-blur-sm"
				title={capped ? `You can attach up to ${MAX_REEL_ATTACHMENTS} reels` : undefined}
			>
				<Checkbox
					checked={selected}
					disabled={capped}
					onCheckedChange={() => reelSelectionStore.toggle(reel.id)}
					aria-label={selected ? 'Deselect reel' : 'Select reel'}
				/>
			</div>
		{/if}

		<!-- Platform badge (top-right) -->
		<span
			class="absolute top-2 right-2 z-2 rounded-[8px] border px-2 py-0.5 text-[10px] font-bold {platform.tone}"
			>{platform.icon} {platform.label}</span
		>

		<!-- Status pill (bottom-left) -->
		<span
			class="absolute bottom-2 left-2 z-2 inline-flex items-center gap-1 rounded-[8px] border px-2 py-0.5 text-[10px] font-bold {status.tone}"
		>
			{#if reel.status === 'processing'}
				<Loader2 class="size-3 animate-spin" />
			{/if}
			{status.label}
		</span>
	</div>

	<!-- Footer: label + actions -->
	<div class="flex items-center gap-1.5 px-2.5 py-2">
		<span class="min-w-0 flex-1 truncate text-[12px] font-medium text-(--ink)">{label}</span>

		<!-- External link to the original post (an off-site TikTok/Instagram URL, so
		     resolve() doesn't apply — mirrors ViralCard/RestaurantCard). -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-(--ink3) transition-colors hover:bg-(--cream) hover:text-(--ink)"
			href={reel.sourceUrl}
			target="_blank"
			rel="noopener noreferrer"
			title="Open original"
			aria-label="Open original post"
		>
			<ExternalLink class="size-3.5" />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		{#if !viewerMode}
			{#if reel.status === 'error'}
				<button
					type="button"
					class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-(--ink3) transition-colors hover:bg-(--cream) hover:text-(--ink)"
					title="Retry extraction"
					aria-label="Retry extraction"
					onclick={() => onretry(reel)}
				>
					<RotateCw class="size-3.5" />
				</button>
			{/if}

			<DropdownMenu>
				<DropdownMenuTrigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-(--ink3) transition-colors hover:bg-(--cream) hover:text-(--ink)"
							title="More"
							aria-label="More"
						>
							<MoreHorizontal class="size-4" />
						</button>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="w-48">
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<FolderInput class="size-4" />
							Move to folder
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent class="w-48">
							{#each folders as f (f.id)}
								<DropdownMenuItem
									class="cursor-pointer"
									disabled={reel.folderId === f.id}
									onSelect={() => onmove(reel, f.id)}
								>
									<FolderIcon class="size-4" />
									<span class="truncate">{f.name}</span>
								</DropdownMenuItem>
							{/each}
							{#if reel.folderId}
								<DropdownMenuSeparator />
								<DropdownMenuItem class="cursor-pointer" onSelect={() => onmove(reel, null)}>
									Remove from folder
								</DropdownMenuItem>
							{/if}
							<DropdownMenuSeparator />
							<DropdownMenuItem class="cursor-pointer" onSelect={() => onnewfolder(reel)}>
								<FolderPlus class="size-4" />
								New folder…
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						class="cursor-pointer"
						onSelect={() => ondelete(reel)}
					>
						<Trash2 class="size-4" />
						Delete reel
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		{/if}
	</div>
</div>
