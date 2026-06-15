<script lang="ts">
	import { marked } from 'marked';
	import { TriangleAlert } from '@lucide/svelte';
	import type { TurnItem } from '$lib/stores';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import ToolCall from './ToolCall.svelte';
	import QuestionForm from './QuestionForm.svelte';

	let { item, onsubmitQuestions }: { item: TurnItem; onsubmitQuestions?: (text: string) => void } =
		$props();

	const html = $derived(
		item.kind === 'assistant' && item.text ? (marked.parse(item.text) as string) : ''
	);
</script>

{#if item.kind === 'thinking'}
	<ThinkingBlock {item} />
{:else if item.kind === 'tool'}
	<ToolCall {item} />
{:else if item.kind === 'questions'}
	<QuestionForm {item} onsubmit={onsubmitQuestions} />
{:else if item.kind === 'user'}
	<!-- User turns get a soft-pink bubble (the ⌘E badge color) so they stand
	     apart from the bare assistant replies. -->
	<div class="flex max-w-full flex-col items-end">
		<div
			class="max-w-[92%] rounded-[14px] rounded-br-[4px] bg-sidebar-accent px-3.5 py-2.5 text-[13.5px] leading-[1.55] break-words text-sidebar-accent-foreground"
		>
			{item.text}
		</div>
	</div>
{:else if item.kind === 'error'}
	<div
		class="flex items-start gap-2 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] leading-[1.5] text-destructive"
	>
		<TriangleAlert class="mt-0.5 size-4 shrink-0" />
		<span>{item.text}</span>
	</div>
{:else}
	<!-- Assistant replies render bare on the page (no bubble), T3/Claude style. -->
	<div class="markdown max-w-full text-[13.5px] leading-[1.55] break-words text-foreground">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html html}
	</div>
{/if}

<style>
	/* Markdown produced by `marked` (@html) needs :global typography rules. */
	.markdown :global(p) {
		margin: 0 0 0.5em;
	}
	.markdown :global(p:last-child) {
		margin-bottom: 0;
	}
	.markdown :global(ul),
	.markdown :global(ol) {
		margin: 0.25em 0 0.5em 1.25em;
	}
	.markdown :global(code) {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.9em;
		background: hsl(var(--muted));
		padding: 1px 4px;
		border-radius: 4px;
	}
</style>
