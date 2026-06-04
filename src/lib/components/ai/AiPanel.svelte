<script lang="ts">
	import { page } from '$app/state';
	import { X } from '@lucide/svelte';
	import { Button } from '$lib/components';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components';
	import { aiPanelStore } from '$lib/stores';
	import { getChatForTrip } from '$lib/remote/chats.remote';
	import type { ChatMessage } from '$lib/schemas';
	import MessageList from './MessageList.svelte';
	import Composer from './Composer.svelte';
	import EmptyState from './EmptyState.svelte';

	let {
		tripTitle
	}: {
		tripTitle?: string;
	} = $props();

	const tripSlug = $derived<string | null>(page.params.slug ?? null);
	const mode = $derived<'new-trip' | 'edit-trip'>(tripSlug ? 'edit-trip' : 'new-trip');

	const chatQuery = $derived(getChatForTrip({ tripSlug }));

	// History = persisted messages from the local JSON store for this trip.
	const history = $derived<ChatMessage[]>(
		(chatQuery.current?.messages as ChatMessage[] | undefined) ?? []
	);

	// Pending = messages currently streaming (cleared once a turn finishes
	// and the server has persisted the new state).
	let pending = $state<ChatMessage[]>([]);
	let streaming = $state(false);
	let authError = $state(false);

	const messages = $derived<ChatMessage[]>([...history, ...pending]);

	async function send(text: string) {
		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			createdAt: Date.now()
		};
		pending = [...pending, userMsg];
		streaming = true;

		const assistantId = crypto.randomUUID();
		let assistantText = '';
		let assistantAdded = false;

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ tripSlug, message: text })
			});
			if (!res.ok || !res.body) throw new Error('chat request failed');

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const parts = buffer.split('\n\n');
				buffer = parts.pop() ?? '';
				for (const part of parts) {
					if (!part.startsWith('data:')) continue;
					const data = part.slice(5).trim();
					if (!data) continue;
					try {
						const event = JSON.parse(data);
						if (event.type === 'text-delta') {
							if (!assistantAdded) {
								assistantAdded = true;
								pending = [
									...pending,
									{
										id: assistantId,
										role: 'assistant',
										content: '',
										createdAt: Date.now()
									}
								];
							}
							assistantText += event.delta;
							pending = pending.map((m) =>
								m.id === assistantId ? { ...m, content: assistantText } : m
							);
						} else if (event.type === 'tool-call') {
							pending = [
								...pending,
								{
									id: crypto.randomUUID(),
									role: 'tool',
									toolName: event.name,
									content: JSON.stringify(event.input, null, 2),
									createdAt: Date.now()
								}
							];
						} else if (event.type === 'error' && event.kind === 'auth_required') {
							authError = true;
						} else if (event.type === 'done') {
							// Server has persisted — refresh history then drop pending.
							await chatQuery.refresh();
							pending = [];
						}
					} catch {
						/* ignore malformed line */
					}
				}
			}
		} catch (err) {
			pending = [
				...pending,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: `Something went wrong: ${err instanceof Error ? err.message : 'unknown error'}`,
					createdAt: Date.now()
				}
			];
		} finally {
			streaming = false;
		}
	}
</script>

<aside class="panel" data-open={aiPanelStore.open}>
	<header>
		<div class="title">
			<span class="dot"></span>
			AI {mode === 'edit-trip' ? '· edit' : '· new trip'}
		</div>
		<Button
			variant="ghost"
			size="icon"
			onclick={() => aiPanelStore.set(false)}
			aria-label="Close AI panel"
		>
			<X class="size-4" />
		</Button>
	</header>

	{#if authError}
		<div class="alert-wrap">
			<Alert variant="destructive">
				<AlertTitle>Claude Code not signed in</AlertTitle>
				<AlertDescription>
					Run <code>claude login</code> in your terminal and reload the page.
				</AlertDescription>
			</Alert>
		</div>
	{/if}

	<div class="body">
		{#if messages.length === 0}
			<EmptyState {mode} {tripTitle} />
		{:else}
			<MessageList {messages} {streaming} />
		{/if}
	</div>

	<Composer
		onsend={send}
		disabled={streaming || authError}
		placeholder={mode === 'edit-trip'
			? `Ask anything about ${tripTitle ?? 'this trip'}…`
			: 'Plan a new trip…'}
	/>
</aside>

<style>
	.panel {
		position: fixed;
		top: 56px;
		right: 0;
		bottom: 0;
		width: 380px;
		max-width: 100vw;
		background: hsl(var(--background));
		border-left: 1px solid hsl(var(--border));
		display: flex;
		flex-direction: column;
		transform: translateX(100%);
		transition: transform 0.22s ease-out;
		z-index: 30;
		box-shadow: -6px 0 24px hsl(var(--foreground) / 0.05);
	}
	.panel[data-open='true'] {
		transform: translateX(0);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px 10px 16px;
		border-bottom: 1px solid hsl(var(--border));
		min-height: 48px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--trip-accent, var(--ui-accent));
		box-shadow: 0 0 0 3px var(--trip-accent-lt, var(--ui-accent-soft));
	}
	.body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.alert-wrap {
		padding: 12px 16px;
	}
</style>
