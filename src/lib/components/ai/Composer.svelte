<script lang="ts">
	import { Button } from '$lib/components';
	import { ArrowUp } from '@lucide/svelte';

	let {
		onsend,
		disabled = false,
		placeholder = 'Plan a trip…'
	}: {
		onsend: (text: string) => void;
		disabled?: boolean;
		placeholder?: string;
	} = $props();

	let value = $state('');
	let ta = $state<HTMLTextAreaElement | null>(null);

	function autoresize() {
		if (!ta) return;
		ta.style.height = 'auto';
		ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
	}

	function send() {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onsend(trimmed);
		value = '';
		queueMicrotask(autoresize);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			send();
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<div class="composer">
	<textarea
		bind:this={ta}
		bind:value
		oninput={autoresize}
		{onkeydown}
		{placeholder}
		{disabled}
		rows="1"
	></textarea>
	<Button
		variant="default"
		size="icon"
		class="send"
		onclick={send}
		disabled={disabled || value.trim().length === 0}
		aria-label="Send"
	>
		<ArrowUp class="size-4" />
	</Button>
</div>

<style>
	.composer {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 12px;
		border-top: 1px solid hsl(var(--border));
		background: hsl(var(--background));
	}
	textarea {
		flex: 1;
		min-height: 36px;
		max-height: 200px;
		resize: none;
		padding: 8px 12px;
		font-size: 13.5px;
		line-height: 1.5;
		border: 1px solid hsl(var(--border));
		border-radius: 12px;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		outline: none;
		font-family: inherit;
	}
	textarea:focus {
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
	}
	textarea:disabled {
		opacity: 0.6;
	}
	:global(.composer .send) {
		flex: 0 0 auto;
		border-radius: 999px;
	}
</style>
