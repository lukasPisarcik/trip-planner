<script lang="ts">
	import favicon from '$lib/assets/logo.svg';
	import { AppSidebar, CommandPalette } from '$lib/essentials';
	import { Sidebar, Tooltip, Toaster, Separator, Button, Breadcrumb } from '$lib/components';
	import { themeStore, aiPanelStore, modelStore, commandPaletteStore } from '$lib/stores';
	import { listTrips } from '$lib/remote/trips.remote';
	import { page } from '$app/state';
	import { Moon, Sun, Sparkles, Search } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import AiPanel from '$lib/components/ai/AiPanel.svelte';
	import type { Trip } from '$lib/trips';
	import '../app.css';

	let { children, data } = $props();

	const viewerMode = $derived(data.viewerMode ?? false);

	onMount(() => {
		themeStore.init();
		aiPanelStore.init();
		modelStore.init();
	});

	const tripsQuery = listTrips({});
	const tripSlug = $derived(page.params.slug);
	const currentTrip = $derived<Trip | undefined>(
		tripSlug ? (tripsQuery.current ?? []).find((t) => t.slug === tripSlug) : undefined
	);

	// The standalone agent workspace is itself a full chat surface — don't also
	// float the slide-in panel over it.
	const isAgentRoute = $derived(page.url.pathname.startsWith('/agent'));

	// The AI assistant attaches to an existing trip: it's only available once the
	// trip has actually resolved (not merely from the route param), so it never
	// flashes on a slow load or an unknown slug. Planning a brand-new trip is the
	// standalone /agent workspace's job, reached from the sidebar / ⌘E.
	const aiPanelAvailable = $derived(!viewerMode && !!currentTrip);
	// Whether the panel is actually occupying space (drives the content padding so
	// it never leaks onto /agent or the home page).
	const aiPanelActive = $derived(aiPanelAvailable && aiPanelStore.open);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider>
	<Sidebar.Provider>
		<AppSidebar />
		<CommandPalette />
		<Sidebar.Inset class="min-w-0">
			<!-- min-w-0 lets the inset shrink below its content's intrinsic width so
			     wide children (tab bar, chat bubbles, day cards) scroll/wrap inside it
			     instead of pushing the page into horizontal overflow on narrow tablets. -->
			<header
				class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/70 px-4 backdrop-blur-md"
			>
				<Sidebar.Trigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-2 h-4" />

				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item>
							{#if currentTrip || isAgentRoute}
								<Breadcrumb.Link href="/">Trips</Breadcrumb.Link>
							{:else}
								<Breadcrumb.Page>Trips</Breadcrumb.Page>
							{/if}
						</Breadcrumb.Item>
						{#if currentTrip}
							<Breadcrumb.Separator />
							<Breadcrumb.Item>
								<Breadcrumb.Page>
									<span class="mr-1">{currentTrip.flag}</span>
									{currentTrip.title}{#if currentTrip.titleEmphasis}&nbsp;{currentTrip.titleEmphasis}{/if}
								</Breadcrumb.Page>
							</Breadcrumb.Item>
						{:else if isAgentRoute}
							<Breadcrumb.Separator />
							<Breadcrumb.Item>
								<Breadcrumb.Page>Agent workspace</Breadcrumb.Page>
							</Breadcrumb.Item>
						{/if}
					</Breadcrumb.List>
				</Breadcrumb.Root>

				<div class="ml-auto flex items-center gap-1">
					<button
						type="button"
						onclick={() => commandPaletteStore.toggle()}
						class="hidden h-9 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
						aria-label="Search"
					>
						<Search class="size-4" />
						<span>Search…</span>
						<kbd
							class="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
						>
							⌘K
						</kbd>
					</button>
					<Button
						variant="ghost"
						size="icon"
						class="sm:hidden"
						onclick={() => commandPaletteStore.toggle()}
						aria-label="Search"
						title="Search"
					>
						<Search class="size-5" />
					</Button>
					{#if aiPanelAvailable}
						<Button
							variant={aiPanelStore.open ? 'secondary' : 'ghost'}
							size="icon"
							onclick={() => aiPanelStore.toggle()}
							aria-label="Toggle AI assistant"
							title="AI assistant"
						>
							<Sparkles class="size-5" />
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						onclick={() => themeStore.toggle()}
						aria-label="Toggle theme"
					>
						{#if themeStore.current === 'dark'}
							<Moon class="size-5" />
						{:else}
							<Sun class="size-5" />
						{/if}
					</Button>
				</div>
			</header>

			<!-- Reserve space for the AI panel only on wide screens (≥1024px); below
			     that it overlays as a drawer (see AiPanel) instead of squishing content. -->
			<div class="min-w-0 flex-1 lg:data-[ai-open=true]:pr-[380px]" data-ai-open={aiPanelActive}>
				{@render children?.()}
			</div>

			{#if aiPanelAvailable}
				<AiPanel
					tripTitle={currentTrip
						? `${currentTrip.title}${currentTrip.titleEmphasis ? ' ' + currentTrip.titleEmphasis : ''}`
						: undefined}
				/>
			{/if}
		</Sidebar.Inset>
	</Sidebar.Provider>
</Tooltip.Provider>

<Toaster richColors closeButton position="top-center" />
