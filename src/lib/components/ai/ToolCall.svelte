<script lang="ts">
	import { Check, X, LoaderCircle, ChevronRight } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { TurnItem } from '$lib/stores';

	let { item }: { item: Extract<TurnItem, { kind: 'tool' }> } = $props();

	let open = $state(false);
	const hasDetail = $derived(!!item.detail);
</script>

<div class="w-fit max-w-full">
	<button
		class={cn(
			'flex max-w-full items-center gap-2 rounded-[10px] border bg-muted/40 px-2.5 py-1.5 text-left text-[12.5px] text-foreground',
			hasDetail && 'cursor-pointer'
		)}
		onclick={() => hasDetail && (open = !open)}
		aria-expanded={hasDetail ? open : undefined}
		disabled={!hasDetail}
	>
		<span class="text-[13px] leading-none">{item.icon}</span>
		<span class="min-w-0 flex-1 truncate font-medium">{item.label}</span>
		<span
			class={cn(
				'inline-flex shrink-0',
				item.status === 'error' ? 'text-destructive' : 'text-[hsl(142_45%_45%)]'
			)}
		>
			{#if item.status === 'running'}
				<LoaderCircle class="size-3.5 animate-spin" />
			{:else if item.status === 'error'}
				<X class="size-3.5" />
			{:else}
				<Check class="size-3.5" />
			{/if}
		</span>
		{#if hasDetail}
			<ChevronRight
				class="size-3.5 shrink-0 text-muted-foreground transition-transform data-[open=true]:rotate-90"
				data-open={open}
			/>
		{/if}
	</button>
	{#if open && item.detail}
		<div class="mt-1 ml-1 border-l-2 px-2.5 py-1.5 text-xs text-muted-foreground">
			{item.detail}
		</div>
	{/if}
</div>
