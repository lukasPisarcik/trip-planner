<script lang="ts">
	import { marked } from 'marked';
	import { Brain, ChevronRight } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { TurnItem } from '$lib/stores';

	let { item }: { item: Extract<TurnItem, { kind: 'thinking' }> } = $props();

	// Expanded live (so reasoning is visible as it streams), collapsed once done.
	// `manualOpen` lets the user override after the fact.
	let manualOpen = $state<boolean | null>(null);
	const open = $derived(manualOpen ?? item.active);

	const html = $derived(item.text ? (marked.parse(item.text) as string) : '');
	const heading = $derived(
		item.active
			? 'Thinking…'
			: item.durationMs
				? `Thought for ${Math.max(1, Math.round(item.durationMs / 1000))}s`
				: 'Thought process'
	);
</script>

<div class={cn('border-l-2 pl-2.5', item.active ? 'border-muted-foreground' : 'border-border')}>
	<button
		class="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent py-0.5 text-xs font-medium text-muted-foreground"
		onclick={() => (manualOpen = !open)}
		aria-expanded={open}
	>
		<Brain class="size-3.5 shrink-0" />
		<span class={item.active ? 'animate-[pulse_1.4s_ease-in-out_infinite]' : ''}>{heading}</span>
		<ChevronRight
			class="size-3.5 shrink-0 transition-transform data-[open=true]:rotate-90"
			data-open={open}
		/>
	</button>
	{#if open && html}
		<div class="markdown mt-1 text-[12.5px] leading-[1.5] text-muted-foreground italic">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html html}
		</div>
	{/if}
</div>

<style>
	/* Markdown produced by `marked` (@html) needs :global typography rules. */
	.markdown :global(p) {
		margin: 0 0 0.4em;
	}
	.markdown :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
