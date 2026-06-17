<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components';
	import AgentChat from '$lib/components/ai/AgentChat.svelte';
	import LogoLoader from '$lib/components/ai/LogoLoader.svelte';
	import { getChatBySession } from '$lib/remote/chats.remote';
	import { chatActivityStore } from '$lib/stores';
	import type { ChatMessage } from '$lib/schemas';

	const sessionId = $derived(page.params.sessionId ?? '');
	const chatQuery = $derived(getChatBySession({ sessionId }));
	const record = $derived(chatQuery.current);
	const history = $derived<ChatMessage[]>((record?.messages as ChatMessage[] | undefined) ?? []);
	const tripSlug = $derived<string | null>(record?.tripSlug ?? null);

	// Keep history live when a turn settles elsewhere — e.g. a chat started in the
	// side panel and expanded here mid-run keeps streaming on the panel's session;
	// its messages land server-side and this page picks them up on the bump. AgentChat
	// renders the live turn until this refreshed history covers it, so there's no flash.
	$effect(() => {
		void chatActivityStore.version;
		chatQuery.refresh();
	});

	async function onDone() {
		await chatQuery.refresh();
	}
</script>

<svelte:head>
	<title>Agent workspace · Trip Planner</title>
</svelte:head>

{#if chatQuery.current === undefined}
	<div class="flex h-[calc(100svh-56px)] items-center justify-center text-muted-foreground">
		<LogoLoader size={11} />
	</div>
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
