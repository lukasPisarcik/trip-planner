<script lang="ts">
	import { marked } from 'marked';
	import type { ChatMessage } from '$lib/schemas';

	let { message }: { message: ChatMessage } = $props();

	const isUser = $derived(message.role === 'user');
	const isTool = $derived(message.role === 'tool');

	const html = $derived(isUser ? '' : (marked.parse(message.content) as string));
</script>

<div class="msg" class:user={isUser} class:tool={isTool}>
	{#if isTool}
		<div class="tool-tag">tool · {message.toolName ?? 'unknown'}</div>
		<pre>{message.content}</pre>
	{:else if isUser}
		<div class="bubble">{message.content}</div>
	{:else}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="bubble markdown">{@html html}</div>
	{/if}
</div>

<style>
	.msg {
		display: flex;
		flex-direction: column;
		max-width: 100%;
	}
	.msg.user {
		align-items: flex-end;
	}
	.bubble {
		padding: 10px 14px;
		border-radius: 14px;
		font-size: 13.5px;
		line-height: 1.55;
		max-width: 92%;
		word-break: break-word;
	}
	.user .bubble {
		background: var(--trip-accent-md, hsl(var(--muted)));
		color: var(--ink, hsl(var(--foreground)));
		border-bottom-right-radius: 4px;
	}
	.msg:not(.user) .bubble {
		background: hsl(var(--muted) / 0.45);
		color: hsl(var(--foreground));
		border-bottom-left-radius: 4px;
	}
	.tool {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 11.5px;
		padding: 8px 12px;
		background: hsl(var(--muted) / 0.3);
		border-radius: 10px;
		color: hsl(var(--muted-foreground));
	}
	.tool-tag {
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-bottom: 4px;
		font-size: 10px;
	}
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
		background: hsl(var(--background));
		padding: 1px 4px;
		border-radius: 4px;
	}
	pre {
		margin: 0;
		white-space: pre-wrap;
		font-family: inherit;
	}
</style>
