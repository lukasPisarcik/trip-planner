<script lang="ts">
	import { resolve } from '$app/paths';
	import { CircleCheck, ArrowRight } from '@lucide/svelte';
	import { toast } from '$lib';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components';
	import { modelStore, createChatSession, messagesToItems } from '$lib/stores';
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
		onDone
	}: {
		tripSlug?: string | null;
		sessionId?: string;
		history?: ChatMessage[];
		mode?: 'new-trip' | 'edit-trip';
		tripTitle?: string;
		onDone?: (sessionId: string | null) => void | Promise<void>;
	} = $props();

	const session = createChatSession();

	const items = $derived([...messagesToItems(history), ...session.items]);

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

	// Celebrate a freshly-planned trip once.
	let lastTripToast: string | null = null;
	$effect(() => {
		const slug = session.createdTripSlug;
		if (slug && slug !== lastTripToast) {
			lastTripToast = slug;
			toast.success('Trip created', { description: 'Your itinerary is ready to view.' });
		}
	});

	async function send(text: string) {
		await session.send(text, {
			tripSlug,
			model: modelStore.forMode(mode),
			sessionId,
			// No session to resume → this is a fresh conversation; create a new chat
			// rather than resuming the trip's latest thread.
			forceNew: !sessionId && !session.lastSessionId,
			onDone: async () => {
				// When the agent planned a trip, keep the thread + "view trip" card on
				// screen — the card is the next step, so we don't navigate or clear.
				if (session.createdTripSlug) return;
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
				<EmptyState {mode} {tripTitle} />
			</div>
		{:else}
			<MessageList
				{items}
				streaming={session.streaming}
				status={session.status}
				statusLabel={session.statusLabel}
				class="mx-auto w-full max-w-[760px] px-4 pt-20"
				style="padding-bottom: {barHeight + 16}px"
				onsubmitQuestions={(text) => send(text)}
			/>
		{/if}
	</div>

	{#if session.authRequired || session.error}
		<div class="pointer-events-none absolute inset-x-0 top-14 z-10">
			<div class="pointer-events-auto mx-auto mt-3 w-full max-w-[760px] px-4">
				{#if session.authRequired}
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
				{:else if session.error}
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
				{#if session.createdTripSlug}
					<div class="px-4 pt-3">
						<div
							class="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
						>
							<CircleCheck class="size-5 shrink-0 text-primary" />
							<div class="min-w-0 flex-1">
								<p class="m-0 text-[13.5px] font-medium text-foreground">Your trip is ready!</p>
								<p class="m-0 truncate text-[12px] text-muted-foreground">
									{session.createdTripSlug}
								</p>
							</div>
							<a
								href={resolve('/trips/[slug]', { slug: session.createdTripSlug })}
								class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90"
							>
								View trip <ArrowRight class="size-3.5" />
							</a>
						</div>
					</div>
				{/if}
				<Composer
					onsend={send}
					onstop={() => session.stop()}
					streaming={session.streaming}
					disabled={session.authRequired || !modelStore.hasAnyProvider}
					usage={session.usage}
					showModel
					placeholder={mode === 'edit-trip'
						? `Ask anything about ${tripTitle ?? 'this trip'}…`
						: 'Plan a new trip…'}
				/>
			</div>
		</div>
	</div>
</div>
