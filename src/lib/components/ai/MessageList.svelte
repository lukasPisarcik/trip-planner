<script lang="ts">
	import { tick } from 'svelte';
	import { cn } from '$lib/utils';
	import type { TurnItem, ChatStatus } from '$lib/stores';
	import Message from './Message.svelte';
	import LogoLoader from './LogoLoader.svelte';

	let {
		items,
		streaming = false,
		status = 'idle',
		statusLabel = '',
		class: className = 'p-4',
		style = '',
		onsubmitQuestions
	}: {
		items: TurnItem[];
		streaming?: boolean;
		status?: ChatStatus;
		statusLabel?: string;
		/** Padding / max-width / centering for the scroll container. */
		class?: string;
		/** Inline style for the scroll container (e.g. a dynamic bottom padding). */
		style?: string;
		/** Submit handler for an inline ask_user question form (answers → next turn). */
		onsubmitQuestions?: (text: string) => void;
	} = $props();

	let scrollEl = $state<HTMLDivElement | null>(null);

	// Show the contextual status line only when there's no visible streaming text
	// yet (thinking / running a tool). Once the assistant is writing, its bubble
	// is the indicator. This replaces the old content-free "three dots".
	const showStatus = $derived(
		streaming && status !== 'responding' && status !== 'error' && !!statusLabel
	);

	$effect(() => {
		void items.length;
		void streaming;
		void statusLabel;
		tick().then(() => {
			if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	});
</script>

<div
	bind:this={scrollEl}
	class={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto', className)}
	{style}
>
	{#each items as item (item.id)}
		<Message {item} {onsubmitQuestions} />
	{/each}
	{#if showStatus}
		<div class="inline-flex w-fit items-center gap-2.5 text-[12.5px] text-muted-foreground">
			<LogoLoader />
			<span>{statusLabel}</span>
		</div>
	{/if}
</div>
