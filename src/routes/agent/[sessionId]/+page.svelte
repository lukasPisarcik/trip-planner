<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components';
	import AgentChat from '$lib/components/ai/AgentChat.svelte';
	import { getChatBySession } from '$lib/remote/chats.remote';
	import type { ChatMessage } from '$lib/schemas';

	const sessionId = $derived(page.params.sessionId ?? '');
	const chatQuery = $derived(getChatBySession({ sessionId }));
	const record = $derived(chatQuery.current);
	const history = $derived<ChatMessage[]>((record?.messages as ChatMessage[] | undefined) ?? []);
	const tripSlug = $derived<string | null>(record?.tripSlug ?? null);

	async function onDone() {
		await chatQuery.refresh();
	}
</script>

<svelte:head>
	<title>Agent workspace · Trip Planner</title>
</svelte:head>

{#if chatQuery.current === undefined}
	<!-- loading -->
{:else if record === null}
	<div
		class="flex h-[calc(100svh-56px)] flex-col items-center justify-center gap-4 text-muted-foreground"
	>
		<p>This session no longer exists.</p>
		<Button href={resolve('/agent')}>Start a new conversation</Button>
	</div>
{:else}
	<AgentChat {tripSlug} {sessionId} mode={tripSlug ? 'edit-trip' : 'new-trip'} {history} {onDone} />
{/if}
