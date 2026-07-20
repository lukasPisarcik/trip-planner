<script lang="ts">
	import { Film, ChevronDown, Check } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
	import { MAX_REEL_ATTACHMENTS, type Reel } from '$lib/schemas';

	let {
		reels,
		selectedIds,
		ontoggle,
		disabled = false
	}: {
		reels: Reel[];
		selectedIds: string[];
		ontoggle: (id: string) => void;
		disabled?: boolean;
	} = $props();

	const count = $derived(selectedIds.length);
	const atLimit = $derived(count >= MAX_REEL_ATTACHMENTS);

	function label(r: Reel): string {
		return (
			r.author?.trim() || (r.caption?.trim() ? r.caption.trim().slice(0, 40) : '') || r.platform
		);
	}
</script>

<Popover>
	<PopoverTrigger
		{disabled}
		class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pr-2 pl-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
	>
		<Film class="size-3.5 shrink-0" />
		<span>Reels</span>
		{#if count > 0}
			<span
				class="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground"
				>{count}</span
			>
		{/if}
		<ChevronDown class="size-3.5 shrink-0 opacity-60" />
	</PopoverTrigger>
	<PopoverContent side="top" align="start" class="w-72 p-0">
		<div class="border-b px-3 py-2">
			<p class="text-xs font-medium text-foreground">Attach reels</p>
			<p class="text-[11px] text-muted-foreground">
				Build from your saved reels{atLimit ? ` · up to ${MAX_REEL_ATTACHMENTS}` : ''}
			</p>
		</div>
		{#if reels.length === 0}
			<div class="px-3 py-6 text-center text-xs text-muted-foreground">
				No saved reels yet. Add some in the
				<a href={resolve('/library')} class="underline hover:text-foreground">Library</a>.
			</div>
		{:else}
			<div class="max-h-72 overflow-y-auto p-1">
				{#each reels as r (r.id)}
					{@const selected = selectedIds.includes(r.id)}
					{@const capped = !selected && atLimit}
					<button
						type="button"
						class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-40"
						disabled={capped}
						onclick={() => ontoggle(r.id)}
					>
						{#if r.thumbnailUrl}
							<img src={r.thumbnailUrl} alt="" class="size-8 shrink-0 rounded object-cover" />
						{:else}
							<span
								class="grid size-8 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground"
								aria-hidden="true">▶</span
							>
						{/if}
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-[13px] leading-tight text-foreground">{label(r)}</span>
							<span class="text-[11px] text-muted-foreground capitalize">
								{r.platform}{r.status !== 'ready' ? ` · ${r.status}` : ''}
							</span>
						</span>
						{#if selected}
							<Check class="size-4 shrink-0 text-primary" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</PopoverContent>
</Popover>
