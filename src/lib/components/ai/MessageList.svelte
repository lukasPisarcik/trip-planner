<script lang="ts">
	import { tick } from 'svelte';
	import type { ChatMessage } from '$lib/schemas';
	import Message from './Message.svelte';

	let { messages, streaming = false }: { messages: ChatMessage[]; streaming?: boolean } = $props();

	let scrollEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		// Re-run on every messages change.
		void messages.length;
		void streaming;
		tick().then(() => {
			if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	});
</script>

<div class="list" bind:this={scrollEl}>
	{#each messages as m (m.id)}
		<Message message={m} />
	{/each}
	{#if streaming}
		<div class="typing"><span></span><span></span><span></span></div>
	{/if}
</div>

<style>
	.list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.typing {
		display: inline-flex;
		gap: 4px;
		padding: 10px 14px;
		background: hsl(var(--muted) / 0.45);
		border-radius: 14px;
		border-bottom-left-radius: 4px;
		width: fit-content;
	}
	.typing span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: hsl(var(--muted-foreground));
		animation: blink 1.2s infinite;
	}
	.typing span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.typing span:nth-child(3) {
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
