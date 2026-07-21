<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { CircleCheck, ArrowRight } from '@lucide/svelte';
	import { toast } from '$lib';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components';
	import {
		modelStore,
		createChatSession,
		mergeItems,
		liveTurnFor,
		reelSelectionStore
	} from '$lib/stores';
	import type { ReelChip } from '$lib/stores/chatSession.svelte';
	import { providerOf, type ChatMessage } from '$lib/schemas';
	import MessageList from './MessageList.svelte';
	import Composer from './Composer.svelte';
	import EmptyState from './EmptyState.svelte';

	let {
		tripSlug = null,
		sessionId,
		history = [],
		mode = 'new-trip',
		tripTitle,
		createdTripSlug = null,
		onDone,
		onSession
	}: {
		tripSlug?: string | null;
		sessionId?: string;
		history?: ChatMessage[];
		mode?: 'new-trip' | 'edit-trip';
		tripTitle?: string;
		/** Durable created-trip slug derived from persisted history (survives reload). */
		createdTripSlug?: string | null;
		onDone?: (sessionId: string | null) => void | Promise<void>;
		/** Fired once, the moment a new-trip turn learns its session id (early redirect). */
		onSession?: (sessionId: string) => void;
	} = $props();

	/** Resume nudge — satisfies ChatRequestSchema's `message.min(1)`. */
	const CONTINUE_NUDGE = 'Please continue.';

	// This surface's own session, used to send turns started here.
	const session = createChatSession();

	// The in-flight turn for this chat, if any — possibly driven by another surface
	// (started in the side panel, then expanded here mid-run). Null once the turn is
	// persisted, so we fall back to history. `liveSession` is what drives the live
	// display state (streaming, status, errors); turns started here use our own.
	const live = $derived(liveTurnFor(sessionId, history));
	const liveSession = $derived(live ?? session);

	// Bug 3 — early redirect. On the new-trip surface (`/agent`, no sessionId), hand
	// the running turn over to the session-scoped view the moment its id is known, so
	// the user watches the rest stream there instead of being stranded. The streaming
	// ChatSession is held by chatActivityStore, so it survives this component
	// unmounting; the session view adopts it via liveTurnFor. Fires once.
	let handedOff = $state(false);
	$effect(() => {
		const id = session.lastSessionId;
		if (id && !sessionId && !handedOff) {
			handedOff = true;
			onSession?.(id);
		}
	});

	// The "trip ready" card comes from the live turn while it streams, else the durable
	// slug derived from persisted history — so the card survives reload and the reset()
	// after handoff/settle.
	const tripReadySlug = $derived(liveSession.createdTripSlug ?? createdTripSlug);

	function onContinue() {
		liveSession.error = null;
		send(CONTINUE_NUDGE);
	}

	// Composer draft, lifted so an EmptyState starter chip can prefill it.
	let composerText = $state('');

	// Reels selected in /library and handed off via "Build trip" seed the composer's
	// attachment chips (drained once). Platform comes from the id prefix; the composer
	// resolves each thumbnail from the live reels query.
	let composerAttachments = $state<ReelChip[]>([]);
	onMount(() => {
		composerAttachments = reelSelectionStore
			.takePending()
			.map((reelId) => ({ reelId, platform: reelId.split('-')[0] ?? '' }));
	});

	// Persisted history + the live turn's items (the user message is deduped by id);
	// once the turn is persisted `live` is null and we render history alone.
	const items = $derived(mergeItems(history, live ? live.items : []));

	// Which provider's login the auth-required alert should point at (the active model's).
	const authProvider = $derived(providerOf(modelStore.current));

	// The floating bottom bar (composer + optional "trip ready" card) overlays the
	// message list. Measure its height so the scroll area reserves exactly enough
	// bottom padding — otherwise the banner covers the tail of the last message.
	let barHeight = $state(0);

	// Surface failures as a transient toast (the inline Alert is the persistent
	// state). Fire once per distinct error object so retries re-notify.
	let lastErr: unknown = null;
	$effect(() => {
		const err = liveSession.error;
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

	// Celebrate a freshly-planned trip once.
	let lastTripToast: string | null = null;
	$effect(() => {
		const slug = liveSession.createdTripSlug;
		if (slug && slug !== lastTripToast) {
			lastTripToast = slug;
			toast.success('Trip created', { description: 'Your itinerary is ready to view.' });
		}
	});

	async function send(text: string, attachments: ReelChip[] = []) {
		await session.send(text, {
			tripSlug,
			model: modelStore.forMode(mode),
			sessionId,
			attachments,
			// No session to resume → this is a fresh conversation; create a new chat
			// rather than resuming the trip's latest thread.
			forceNew: !sessionId && !session.lastSessionId,
			onDone: async () => {
				// Handed off to the session-scoped view (Bug 3): it now owns the turn via
				// liveTurnFor, so don't reset() or navigate — that would tear down the
				// live turn the new view is adopting.
				if (handedOff) return;
				// Otherwise parent refreshes persisted history (or navigates); drop the
				// live turn so it isn't rendered twice alongside the refreshed history.
				await onDone?.(session.lastSessionId);
				session.reset();
			}
		});
	}
</script>

<!-- Pulled up under the sticky 56px header (-mt-14) so messages scroll beneath
     the frosted navbar; the floating composer below mirrors it. -->
<div class="relative -mt-14 flex h-svh min-h-0 flex-col">
	<div class="flex min-h-0 flex-1 flex-col">
		{#if items.length === 0}
			<div class="flex flex-1 items-center justify-center pt-14">
				<EmptyState {mode} {tripTitle} onExample={(text) => (composerText = text)} />
			</div>
		{:else}
			<MessageList
				{items}
				streaming={liveSession.streaming}
				status={liveSession.status}
				statusLabel={liveSession.statusLabel}
				elapsed={liveSession.elapsedMs}
				class="mx-auto w-full max-w-[760px] px-4 pt-20"
				style="padding-bottom: {barHeight + 16}px"
				onsubmitQuestions={(text) => send(text)}
				{onContinue}
			/>
		{/if}
	</div>

	{#if liveSession.authRequired || liveSession.error}
		<div class="pointer-events-none absolute inset-x-0 top-14 z-10">
			<div class="pointer-events-auto mx-auto mt-3 w-full max-w-[760px] px-4">
				{#if liveSession.authRequired}
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
				{:else if liveSession.error}
					<Alert variant="destructive">
						<AlertTitle>
							{liveSession.error.kind === 'timeout'
								? 'The agent timed out'
								: 'Something went wrong'}
						</AlertTitle>
						<AlertDescription>
							{liveSession.error.kind === 'timeout'
								? 'The model stopped responding. Try sending your message again.'
								: 'The agent hit an error. Try again.'}
						</AlertDescription>
					</Alert>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Floating frosted bar: messages dissolve into it as they scroll under. -->
	<div class="pointer-events-none absolute inset-x-0 bottom-0 z-10">
		<div class="h-6 bg-gradient-to-t from-background/70 to-transparent"></div>
		<div
			bind:clientHeight={barHeight}
			class="pointer-events-auto bg-background/70 backdrop-blur-md"
		>
			<div class="mx-auto w-full max-w-[760px]">
				{#if tripReadySlug}
					<div class="px-4 pt-3">
						<div
							class="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
						>
							<CircleCheck class="size-5 shrink-0 text-primary" />
							<div class="min-w-0 flex-1">
								<p class="m-0 text-[13.5px] font-medium text-foreground">Your trip is ready!</p>
								<p class="m-0 truncate text-[12px] text-muted-foreground">
									{tripReadySlug}
								</p>
							</div>
							<a
								href={resolve('/trips/[slug]', { slug: tripReadySlug })}
								class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90"
							>
								View trip <ArrowRight class="size-3.5" />
							</a>
						</div>
					</div>
				{/if}
				<Composer
					bind:value={composerText}
					bind:attachments={composerAttachments}
					onsend={send}
					onstop={() => liveSession.stop()}
					streaming={liveSession.streaming}
					disabled={liveSession.authRequired || !modelStore.hasAnyProvider}
					usage={liveSession.usage}
					showModel
					placeholder={mode === 'edit-trip'
						? `Ask anything about ${tripTitle ?? 'this trip'}…`
						: 'Plan a new trip…'}
				/>
			</div>
		</div>
	</div>
</div>
