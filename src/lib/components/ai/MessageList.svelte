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
		onsubmitQuestions,
		onContinue
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
		/** Resume the errored turn (rendered as a Continue button below the list). */
		onContinue?: () => void;
	} = $props();

	let scrollEl = $state<HTMLDivElement | null>(null);
	// Follow streaming output only while the user is pinned near the bottom; scrolling
	// up to read pauses autoscroll, returning to the bottom resumes it.
	let stick = $state(true);

	// Show the contextual status line only when there's no visible streaming text
	// yet (thinking / running a tool). Once the assistant is writing, its bubble
	// is the indicator. This replaces the old content-free "three dots".
	const showStatus = $derived(
		streaming && status !== 'responding' && status !== 'error' && !!statusLabel
	);
	// The last item is an errored turn and the turn has settled → offer a Continue.
	const lastIsError = $derived(items.at(-1)?.kind === 'error');

	// Total streamed text length: thinking/assistant deltas mutate an existing item's
	// `.text` in place without changing items.length, so this is what makes the
	// autoscroll effect re-fire during a long thinking/response block.
	const contentLen = $derived(items.reduce((n, i) => n + ('text' in i ? i.text.length : 0), 0));

	function onScroll() {
		if (!scrollEl) return;
		const gap = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
		stick = gap < 80; // near the bottom → keep following
	}

	// A new turn starting (streaming false→true, incl. Continue) snaps back to the
	// bottom, so a user who'd scrolled up to read still follows their own new turn.
	let wasStreaming = false;
	$effect(() => {
		if (streaming && !wasStreaming) stick = true;
		wasStreaming = streaming;
	});

	$effect(() => {
		void items.length;
		void contentLen;
		void streaming;
		void statusLabel;
		if (!stick) return;
		tick().then(() => {
			if (stick && scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	});
</script>

<div
	bind:this={scrollEl}
	onscroll={onScroll}
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
	{#if !streaming && lastIsError && onContinue}
		<button
			type="button"
			onclick={onContinue}
			class="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-[12.5px] font-medium text-primary transition hover:bg-primary/10"
		>
			Continue
		</button>
	{/if}
</div>
