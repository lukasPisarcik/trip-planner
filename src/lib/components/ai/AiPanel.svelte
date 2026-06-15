<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ChevronLeft, ExternalLink, X, Plus, MessageSquare } from '@lucide/svelte';
	import { toast } from '$lib';
	import { Button } from '$lib/components';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components';
	import {
		aiPanelStore,
		modelStore,
		createChatSession,
		messagesToItems,
		chatActivityStore
	} from '$lib/stores';
	import { listChats, getChatBySession } from '$lib/remote/chats.remote';
	import { providerOf, type ChatMessage } from '$lib/schemas';
	import MessageList from './MessageList.svelte';
	import Composer from './Composer.svelte';
	import EmptyState from './EmptyState.svelte';

	let {
		tripTitle
	}: {
		tripTitle?: string;
	} = $props();

	// The panel only renders on a trip page, so a slug is always present.
	const tripSlug = $derived<string>(page.params.slug ?? '');

	// Which provider's login the auth-required alert should point at (the active model's).
	const authProvider = $derived(providerOf(modelStore.current));

	// All conversations for this trip (newest first), for the picker.
	const chatsListQuery = listChats({});
	// Keep the list live when a turn (here or in the standalone workspace) creates
	// or updates a session — chats are server-mediated, so we refresh on the signal.
	$effect(() => {
		void chatActivityStore.version;
		chatsListQuery.refresh();
	});
	interface SessionRecord {
		sessionId: string;
		tripSlug: string | null;
		messages: ChatMessage[];
		updatedAt: number;
	}
	const tripSessions = $derived<SessionRecord[]>(
		(chatsListQuery.current ?? []).filter((s) => s.tripSlug === tripSlug)
	);

	type View = 'list' | 'chat';
	let view = $state<View>('list');
	let selectedSessionId = $state<string | null>(null);
	// A freshly-started chat renders only its live turns (no persisted history to
	// merge yet) — avoids double-rendering once the turn is saved server-side.
	let liveOnly = $state(false);

	const session = createChatSession();

	// Surface failures as a toast (the inline Alert remains the persistent state).
	let lastErr: unknown = null;
	$effect(() => {
		const err = session.error;
		if (err && err !== lastErr) {
			lastErr = err;
			toast.error(
				err.kind === 'timeout'
					? 'The agent timed out — try sending again.'
					: err.kind === 'network'
						? 'Connection lost — try again.'
						: 'Something went wrong during the chat.'
			);
		} else if (!err) {
			lastErr = null;
		}
	});

	// A trip created from the panel (rare in edit mode) gets a lightweight nudge.
	let lastTripToast: string | null = null;
	$effect(() => {
		const slug = session.createdTripSlug;
		if (slug && slug !== lastTripToast) {
			lastTripToast = slug;
			toast.success('Trip created', { description: 'Open it from the sidebar to view.' });
		}
	});

	// History for the selected (existing) session. New chats skip this (liveOnly).
	const sessionQuery = $derived(
		!liveOnly && selectedSessionId ? getChatBySession({ sessionId: selectedSessionId }) : null
	);
	const history = $derived<ChatMessage[]>(
		(sessionQuery?.current?.messages as ChatMessage[] | undefined) ?? []
	);
	const items = $derived(
		liveOnly ? session.items : [...messagesToItems(history), ...session.items]
	);

	// Switching trips resets the panel back to the conversation list.
	$effect(() => {
		void tripSlug;
		resetToList();
	});
	// Each time the panel is closed, return to the list so it reopens fresh.
	$effect(() => {
		if (!aiPanelStore.open) view = 'list';
	});

	function resetToList() {
		session.stop();
		session.reset();
		selectedSessionId = null;
		liveOnly = false;
		view = 'list';
	}
	function openSession(id: string) {
		session.reset();
		selectedSessionId = id;
		liveOnly = false;
		view = 'chat';
	}
	function startNewChat() {
		session.reset();
		selectedSessionId = null;
		liveOnly = true;
		view = 'chat';
	}
	function backToList() {
		session.stop();
		session.reset();
		selectedSessionId = null;
		liveOnly = false;
		view = 'list';
		chatsListQuery.refresh();
	}

	function sessionTitle(messages: ChatMessage[]): string {
		const first = messages.find((m) => m.role === 'user');
		const text = first?.content.trim().replace(/\s+/g, ' ') ?? 'New conversation';
		return text.length > 38 ? text.slice(0, 38) + '…' : text;
	}
	function relativeTime(ts: number): string {
		const m = Math.round((Date.now() - ts) / 60000);
		if (m < 1) return 'now';
		if (m < 60) return `${m}m`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h}h`;
		return `${Math.round(h / 24)}d`;
	}

	// Expand the current conversation into the standalone /agent workspace.
	async function openInAgent() {
		if (selectedSessionId) {
			await goto(resolve('/agent/[sessionId]', { sessionId: selectedSessionId }));
		} else {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(`${resolve('/agent')}?slug=${encodeURIComponent(tripSlug)}`);
		}
	}

	async function send(text: string) {
		const resumeId = selectedSessionId ?? session.lastSessionId ?? undefined;
		await session.send(text, {
			tripSlug,
			model: modelStore.forMode('edit-trip'),
			sessionId: resumeId,
			// "New chat" has no session to resume → force a fresh thread instead of
			// resuming the trip's latest (getOrCreateChat) thread.
			forceNew: !resumeId,
			onDone: async () => {
				await chatsListQuery.refresh();
				if (selectedSessionId && !liveOnly) {
					// Existing session: reload persisted history, drop the live dup.
					await sessionQuery?.refresh();
					session.reset();
				} else if (session.lastSessionId) {
					// New chat just learned its id — keep the live turns on screen and
					// resume this session on the next message.
					selectedSessionId = session.lastSessionId;
				}
			}
		});
	}
</script>

{#if aiPanelStore.open}
	<!-- Dismissable scrim shown only on narrow screens, where the panel overlays
	     the content instead of pushing it (see the layout media query). -->
	<button
		class="fixed inset-x-0 top-14 bottom-0 z-[25] cursor-pointer border-0 bg-foreground/30 p-0 lg:hidden"
		aria-label="Close AI panel"
		onclick={() => aiPanelStore.set(false)}
	></button>
{/if}

<aside
	class="fixed top-14 right-0 bottom-0 z-30 flex w-[380px] max-w-[100vw] translate-x-full flex-col border-l bg-background shadow-xl transition-transform duration-200 ease-out data-[open=true]:translate-x-0"
	data-open={aiPanelStore.open}
>
	<header class="flex min-h-12 items-center justify-between border-b py-2.5 pr-3 pl-4">
		<div class="flex items-center gap-2 text-[13px] font-semibold tracking-[0.02em]">
			{#if view === 'chat'}
				<button
					class="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					onclick={backToList}
					aria-label="Back to conversations"
					title="Back"
				>
					<ChevronLeft class="size-4" />
				</button>
			{:else}
				<span class="size-2 rounded-full bg-primary ring-4 ring-primary/20"></span>
			{/if}
			AI assistant
		</div>
		<div class="flex items-center gap-0.5">
			{#if view === 'chat'}
				<Button
					variant="ghost"
					size="icon"
					onclick={openInAgent}
					title="Open in agent workspace"
					aria-label="Open in agent workspace"
				>
					<ExternalLink class="size-4" />
				</Button>
			{/if}
			<Button
				variant="ghost"
				size="icon"
				onclick={() => aiPanelStore.set(false)}
				aria-label="Close AI panel"
			>
				<X class="size-4" />
			</Button>
		</div>
	</header>

	{#if session.authRequired}
		<div class="px-4 py-3">
			<Alert variant="destructive">
				{#if authProvider === 'openai'}
					<AlertTitle>Codex not signed in</AlertTitle>
					<AlertDescription>
						Run <code>codex login</code> in your terminal and reload the page.
					</AlertDescription>
				{:else}
					<AlertTitle>Claude Code not signed in</AlertTitle>
					<AlertDescription>
						Run <code>claude login</code> in your terminal and reload the page.
					</AlertDescription>
				{/if}
			</Alert>
		</div>
	{:else if session.error}
		<div class="px-4 py-3">
			<Alert variant="destructive">
				<AlertTitle>
					{session.error.kind === 'timeout' ? 'The agent timed out' : 'Something went wrong'}
				</AlertTitle>
				<AlertDescription>
					{session.error.kind === 'timeout'
						? 'The model stopped responding. Try sending your message again.'
						: 'The agent hit an error. Try again.'}
				</AlertDescription>
			</Alert>
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
		{#if view === 'list'}
			<div class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
				<button
					class="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border bg-background text-[13.5px] font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
					onclick={startNewChat}
				>
					<Plus class="size-4" />
					<span>New chat</span>
				</button>
				{#if tripSessions.length > 0}
					<div class="flex flex-col gap-0.5">
						{#each tripSessions as s (s.sessionId)}
							<button
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-muted/50"
								onclick={() => openSession(s.sessionId)}
							>
								<MessageSquare class="size-3.5 shrink-0 text-muted-foreground" />
								<span class="min-w-0 flex-1 truncate">{sessionTitle(s.messages)}</span>
								<span class="shrink-0 text-[10px] text-muted-foreground">
									{relativeTime(s.updatedAt)}
								</span>
							</button>
						{/each}
					</div>
				{:else}
					<p class="m-0 px-1 pt-1 text-[12.5px] leading-normal text-muted-foreground">
						No conversations yet for {tripTitle ?? 'this trip'}. Start one above.
					</p>
				{/if}
			</div>
		{:else if items.length === 0}
			<EmptyState mode="edit-trip" {tripTitle} />
		{:else}
			<MessageList
				{items}
				streaming={session.streaming}
				status={session.status}
				statusLabel={session.statusLabel}
				class="p-4 pb-32"
				onsubmitQuestions={(text) => send(text)}
			/>
		{/if}
	</div>

	{#if view === 'chat'}
		<!-- Floating frosted bar mirroring the agent workspace: messages scroll
		     beneath it inside the panel. -->
		<div class="pointer-events-none absolute inset-x-0 bottom-0 z-10">
			<div class="h-6 bg-gradient-to-t from-background/70 to-transparent"></div>
			<div class="pointer-events-auto bg-background/70 backdrop-blur-md">
				<Composer
					onsend={send}
					onstop={() => session.stop()}
					streaming={session.streaming}
					disabled={session.authRequired || !modelStore.hasAnyProvider}
					usage={session.usage}
					showModel
					placeholder={`Ask anything about ${tripTitle ?? 'this trip'}…`}
				/>
			</div>
		</div>
	{/if}
</aside>
