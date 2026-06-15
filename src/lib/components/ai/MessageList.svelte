<script lang="ts">
	import { tick } from 'svelte';
	import { cn } from '$lib/utils';
	import type { TurnItem, ChatStatus } from '$lib/stores';
	import Message from './Message.svelte';

	let {
		items,
		streaming = false,
		status = 'idle',
		statusLabel = '',
		class: className = 'p-4'
	}: {
		items: TurnItem[];
		streaming?: boolean;
		status?: ChatStatus;
		statusLabel?: string;
		/** Padding / max-width / centering for the scroll container. */
		class?: string;
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
>
	{#each items as item (item.id)}
		<Message {item} />
	{/each}
	{#if showStatus}
		<div class="inline-flex w-fit items-center gap-2 text-[12.5px] text-muted-foreground">
			<span class="dots inline-flex gap-1"><span></span><span></span><span></span></span>
			<span>{statusLabel}</span>
		</div>
	{/if}
</div>

<style>
	/* Typing dots — a staggered keyframe loop that has no Tailwind utility. */
	.dots span {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: hsl(var(--muted-foreground));
		animation: blink 1.2s infinite;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes blink {
		0%,
		60%,
		100% {
			opacity: 0.3;
		}
		30% {
			opacity: 1;
		}
	}
</style>
