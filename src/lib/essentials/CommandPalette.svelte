<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Command, Dialog } from '$lib/components';
	import { commandPaletteStore } from '$lib/stores';
	import { listTrips } from '$lib/remote/trips.remote';
	import { listChats } from '$lib/remote/chats.remote';
	import { House, Sparkles, MessageSquare } from '@lucide/svelte';
	import type { Trip } from '$lib/trips';
	import type { ChatMessage } from '$lib/schemas';

	interface SessionRecord {
		sessionId: string;
		tripSlug: string | null;
		messages: ChatMessage[];
		updatedAt: number;
	}

	const viewerMode = $derived(page.data.viewerMode ?? false);

	const tripsQuery = listTrips({});
	const trips = $derived<Trip[]>(tripsQuery.current ?? []);

	const chatsQuery = listChats({});
	const sessions = $derived<SessionRecord[]>(chatsQuery.current ?? []);

	let search = $state('');
	const isEmpty = $derived(search.trim() === '');

	// When the query is empty we show a curated "Suggested" list (favorites first,
	// plus the most recent conversations) instead of every item.
	const suggestedTrips = $derived(
		[...trips].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)).slice(0, 6)
	);
	const recentSessions = $derived(sessions.slice(0, 5));

	function sessionTitle(messages: ChatMessage[]): string {
		const first = messages.find((m) => m.role === 'user');
		const text = first?.content.trim().replace(/\s+/g, ' ') ?? 'New conversation';
		return text.length > 48 ? text.slice(0, 48) + '…' : text;
	}

	async function run(fn: () => void | Promise<void>) {
		commandPaletteStore.set(false);
		await fn();
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			commandPaletteStore.toggle();
		}
	}

	// Reset the query each time the palette closes so it reopens fresh.
	$effect(() => {
		if (!commandPaletteStore.open) search = '';
	});

	async function newAgentChat() {
		await goto(resolve('/agent'));
	}
</script>

<svelte:window onkeydown={onKeydown} />

<Dialog.Root bind:open={commandPaletteStore.open}>
	<!-- Top-anchored (top-12%, translate-y-0) with a fixed-height scrolling list so
	     the box never moves or resizes as results change. -->
	<Dialog.Content
		showCloseButton={false}
		class="top-[12%] max-w-[640px] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[640px]"
	>
		<Dialog.Header class="sr-only">
			<Dialog.Title>Search</Dialog.Title>
			<Dialog.Description>Search trips, conversations and actions</Dialog.Description>
		</Dialog.Header>

		<Command.Root
			shouldFilter={!isEmpty}
			class="**:data-[slot=command-input-wrapper]:h-12 [&_[data-command-group]]:px-2 [&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 [&_[data-command-input-wrapper]_svg]:h-5 [&_[data-command-input-wrapper]_svg]:w-5 [&_[data-command-input]]:h-12 [&_[data-command-item]]:px-2 [&_[data-command-item]]:py-3 [&_[data-command-item]_svg]:h-5 [&_[data-command-item]_svg]:w-5"
		>
			<Command.Input bind:value={search} placeholder="Search trips, conversations, actions…" />
			<Command.List class="h-[min(420px,65vh)] max-h-none">
				<Command.Empty>No results found.</Command.Empty>

				<Command.Group heading="Actions">
					<Command.Item value="all trips home" onSelect={() => run(() => goto(resolve('/')))}>
						<House />
						<span>All trips</span>
					</Command.Item>
					{#if !viewerMode}
						<Command.Item value="plan new trip with ai agent" onSelect={() => run(newAgentChat)}>
							<Sparkles />
							<span>Plan a new trip with AI</span>
						</Command.Item>
					{/if}
				</Command.Group>

				{#if isEmpty}
					{#if suggestedTrips.length > 0 || recentSessions.length > 0}
						<Command.Separator />
						<Command.Group heading="Suggested">
							{#each suggestedTrips as trip (trip.slug)}
								<Command.Item
									value={`${trip.title} ${trip.titleEmphasis ?? ''} ${trip.slug}`}
									onSelect={() => run(() => goto(resolve('/trips/[slug]', { slug: trip.slug })))}
								>
									<span class="text-base leading-none">{trip.flag}</span>
									<span class="truncate">
										{trip.title}{#if trip.titleEmphasis}&nbsp;{trip.titleEmphasis}{/if}
									</span>
								</Command.Item>
							{/each}
							{#each recentSessions as s (s.sessionId)}
								<Command.Item
									value={`${sessionTitle(s.messages)} ${s.sessionId}`}
									onSelect={() =>
										run(() => goto(resolve('/agent/[sessionId]', { sessionId: s.sessionId })))}
								>
									<MessageSquare />
									<span class="truncate">{sessionTitle(s.messages)}</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				{:else}
					{#if trips.length > 0}
						<Command.Separator />
						<Command.Group heading="Trips">
							{#each trips as trip (trip.slug)}
								<Command.Item
									value={`${trip.title} ${trip.titleEmphasis ?? ''} ${trip.slug}`}
									onSelect={() => run(() => goto(resolve('/trips/[slug]', { slug: trip.slug })))}
								>
									<span class="text-base leading-none">{trip.flag}</span>
									<span class="truncate">
										{trip.title}{#if trip.titleEmphasis}&nbsp;{trip.titleEmphasis}{/if}
									</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}

					{#if sessions.length > 0}
						<Command.Separator />
						<Command.Group heading="Conversations">
							{#each sessions as s (s.sessionId)}
								<Command.Item
									value={`${sessionTitle(s.messages)} ${s.sessionId}`}
									onSelect={() =>
										run(() => goto(resolve('/agent/[sessionId]', { sessionId: s.sessionId })))}
								>
									<MessageSquare />
									<span class="truncate">{sessionTitle(s.messages)}</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				{/if}
			</Command.List>
		</Command.Root>
	</Dialog.Content>
</Dialog.Root>
