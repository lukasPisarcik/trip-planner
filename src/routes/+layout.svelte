<script lang="ts">
	import favicon from '$lib/assets/logo.svg';
	import { AppSidebar } from '$lib/essentials';
	import { Sidebar, Tooltip, Toaster, Separator, Button, Breadcrumb } from '$lib/components';
	import { themeStore, aiPanelStore } from '$lib/stores';
	import { listTrips } from '$lib/remote/trips.remote';
	import { page } from '$app/state';
	import { Moon, Sun, Sparkles } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import AiPanel from '$lib/components/ai/AiPanel.svelte';
	import type { Trip } from '$lib/trips';
	import '../app.css';

	let { children, data } = $props();

	const viewerMode = $derived(data.viewerMode ?? false);

	onMount(() => {
		themeStore.init();
		aiPanelStore.init();
	});

	const tripsQuery = listTrips({});
	const tripSlug = $derived(page.params.slug);
	const currentTrip = $derived<Trip | undefined>(
		tripSlug ? (tripsQuery.current ?? []).find((t) => t.slug === tripSlug) : undefined
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider>
	<Sidebar.Provider>
		<AppSidebar />
		<Sidebar.Inset>
			<header
				class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm"
			>
				<Sidebar.Trigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-2 h-4" />

				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item>
							{#if currentTrip}
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
						{/if}
					</Breadcrumb.List>
				</Breadcrumb.Root>

				<div class="ml-auto flex items-center gap-1">
					{#if !viewerMode}
						<Button
							variant={aiPanelStore.open ? 'secondary' : 'ghost'}
							size="icon"
							onclick={() => aiPanelStore.toggle()}
							aria-label="Toggle AI panel"
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

			<div class="content-area flex-1" data-ai-open={aiPanelStore.open}>
				{@render children?.()}
			</div>

			{#if !viewerMode}
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

<style>
	/* Only reserve space for the AI panel when the viewport is wide enough to fit
	   sidebar + content + the 380px panel. Below this it overlays as a drawer
	   (see AiPanel.svelte) instead of squishing the content. */
	@media (min-width: 1024px) {
		.content-area[data-ai-open='true'] {
			padding-right: 380px;
		}
	}
</style>
