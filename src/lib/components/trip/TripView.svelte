<script lang="ts">
	import type { Trip, Day } from '$lib/trips';
	import Hero from './Hero.svelte';
	import TabBar from './TabBar.svelte';
	import TripMap from './TripMap.svelte';
	import { buildAllSpots, dayFocus } from './tabs/mapLayers';
	import ItineraryTab from './tabs/ItineraryTab.svelte';
	import TransportTab from './tabs/TransportTab.svelte';
	import ViralTab from './tabs/ViralTab.svelte';
	import FlightsTab from './tabs/FlightsTab.svelte';
	import BudgetTab from './tabs/BudgetTab.svelte';
	import TipsTab from './tabs/TipsTab.svelte';
	import RestaurantsTab from './tabs/RestaurantsTab.svelte';
	import BrainstormTab from './tabs/BrainstormTab.svelte';

	let { trip, viewerMode = false }: { trip: Trip; viewerMode?: boolean } = $props();

	const allTabs = [
		{ id: 'brainstorm', label: '💭 Brainstorm' },
		{ id: 'itinerary', label: '📅 Itinerary' },
		{ id: 'transport', label: '🚌 Transport' },
		{ id: 'viral', label: '📸 Viral Spots' },
		{ id: 'restaurants', label: '🍽️ Food & Drink' },
		{ id: 'flights', label: '✈️ Flights' },
		{ id: 'budget', label: '💶 Budget' },
		{ id: 'tips', label: '💡 Tips' }
	];

	// Brainstorm is a private planning scratchpad (and the only editable tab) —
	// hide it on read-only public deployments.
	const tabs = $derived(viewerMode ? allTabs.filter((t) => t.id !== 'brainstorm') : allTabs);

	let active = $state('itinerary');

	const accentStrong: Record<Trip['accent'], string> = {
		sage: '#86efac',
		rose: '#fda4af',
		amber: '#fde68a',
		sky: '#bae6fd',
		violet: '#ddd6fe'
	};

	// ── Map backdrop ──────────────────────────────────────────────────────────
	// One constant marker set, derived from the trip, shown on every tab.
	const layers = $derived(buildAllSpots(trip));
	// No coordinates anywhere → no backdrop; fall back to the solid hero banner.
	const hasMap = $derived(layers.spots.length > 0);

	let tripMap = $state<ReturnType<typeof TripMap> | undefined>(undefined);
	let focusedKey = $state<string | null>(null);

	function focusOnDay(day: Day) {
		focusedKey = `${day.number}-${day.date}`;
		tripMap?.focus(dayFocus(day));
	}
	function showAll() {
		focusedKey = null;
		tripMap?.reset();
	}

	// ── Scroll-collapse + expand state ──────────────────────────────────────────
	const COLLAPSED = 120; // px peek — the map never fully disappears
	const HEADER_H = 56; // the app header (h-14)

	let scrollY = $state(0);
	let innerH = $state(800);
	let fullscreen = $state(false);

	// Expanded height is capped so it never dominates short viewports.
	const expanded = $derived(Math.min(520, Math.round(innerH * 0.52)));
	const mapHeight = $derived(
		fullscreen ? Math.round(innerH * 0.88) : Math.max(COLLAPSED, expanded - scrollY)
	);
	// Past the collapse point the hero condenses and the map goes static.
	const scrolled = $derived(!fullscreen && scrollY > expanded - COLLAPSED - 40);
	// Pan/zoom only when there's room to interact (top of page or fullscreen).
	const interactive = $derived(fullscreen || (!scrolled && hasMap));

	function toggleFullscreen() {
		fullscreen = !fullscreen;
	}

	// rAF-throttled window scroll → scrollY (the page scrolls on the body; the
	// sticky backdrop shrinks as it rises). Also tracks viewport height.
	$effect(() => {
		innerH = window.innerHeight;
		scrollY = window.scrollY;
		let raf = 0;
		const onScroll = () => {
			if (!raf)
				raf = requestAnimationFrame(() => {
					scrollY = window.scrollY;
					raf = 0;
				});
		};
		const onResize = () => (innerH = window.innerHeight);
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			if (raf) cancelAnimationFrame(raf);
		};
	});

	// Escape closes the fullscreen map.
	$effect(() => {
		if (!fullscreen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') fullscreen = false;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const styleVars = $derived(
		[
			`--trip-accent: var(--${trip.accent})`,
			`--trip-accent-lt: var(--${trip.accent}-lt)`,
			`--trip-accent-md: var(--${trip.accent}-md)`,
			`--trip-accent-strong: ${accentStrong[trip.accent]}`,
			`--header-h: ${HEADER_H}px`,
			// The glass tab bar pins just below the collapsed map peek.
			`--tab-bar-top: ${hasMap ? `${HEADER_H + COLLAPSED}px` : '3.5rem'}`
		].join('; ')
	);
</script>

<div class="trip-root" class:has-map={hasMap} style={styleVars}>
	{#if hasMap}
		<!-- Persistent backdrop: mounted once, NEVER inside the {#if active} switch,
		     so switching tabs never remounts or reloads it. -->
		<div
			class="map-stage"
			class:fullscreen
			class:collapsed={scrolled}
			style="height: {mapHeight}px"
		>
			<TripMap bind:this={tripMap} {layers} height={mapHeight} {interactive} />
			<Hero {trip} glass compact={scrolled} />
			<div class="map-controls">
				{#if focusedKey}
					<button type="button" class="map-btn" onclick={showAll}>Show all spots</button>
				{/if}
				<button
					type="button"
					class="map-btn map-expand"
					onclick={toggleFullscreen}
					aria-label={fullscreen ? 'Close expanded map' : 'Expand map'}
					title={fullscreen ? 'Close' : 'Expand map'}
				>
					{fullscreen ? '✕' : '⤢'}
				</button>
			</div>
		</div>
		{#if fullscreen}
			<button type="button" class="scrim" aria-label="Close expanded map" onclick={toggleFullscreen}
			></button>
		{/if}
	{:else}
		<Hero {trip} />
	{/if}

	<!-- While the map is fullscreen, take the content behind the scrim out of the
	     tab order + a11y tree so keyboard focus can't land on hidden controls. -->
	<div class="glass-stack" inert={fullscreen} aria-hidden={fullscreen}>
		<TabBar {tabs} {active} onselect={(id) => (active = id)} glass={hasMap} />

		<div class="content" class:glass={hasMap}>
			{#if active === 'brainstorm'}
				<BrainstormTab slug={trip.slug} content={trip.brainstorm} />
			{:else if active === 'itinerary'}
				<ItineraryTab data={trip.itinerary} onfocusday={hasMap ? focusOnDay : undefined} />
			{:else if active === 'transport'}
				<TransportTab data={trip.transport} />
			{:else if active === 'viral'}
				<ViralTab data={trip.viral} />
			{:else if active === 'restaurants'}
				<RestaurantsTab data={trip.restaurants} />
			{:else if active === 'flights'}
				<FlightsTab data={trip.flights} />
			{:else if active === 'budget'}
				<BudgetTab data={trip.budget} />
			{:else if active === 'tips'}
				<TipsTab data={trip.tips} />
			{/if}
		</div>
	</div>
</div>

<style>
	.trip-root {
		position: relative;
	}

	/* The map stage stacks the map, the glass hero and the controls in one cell,
	   stays pinned under the app header, and shrinks as the page scrolls. */
	.map-stage {
		position: sticky;
		top: var(--header-h);
		z-index: 0;
		display: grid;
		grid-template-areas: 'stage';
		overflow: hidden;
		background: var(--cream);
	}
	.map-stage > :global(*) {
		grid-area: stage;
		min-width: 0;
	}
	/* The glass hero sits at the top of the map; controls top-right. */
	.map-stage :global(.hero) {
		align-self: start;
		z-index: 2;
	}
	.map-controls {
		align-self: start;
		justify-self: end;
		z-index: 3;
		display: flex;
		gap: 8px;
		padding: 12px;
	}
	.map-btn {
		pointer-events: auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 34px;
		min-width: 34px;
		padding: 0 10px;
		border-radius: 10px;
		font-size: 15px;
		font-weight: 600;
		color: var(--ink);
		background: var(--glass-bg);
		-webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%);
		backdrop-filter: blur(var(--glass-blur)) saturate(160%);
		border: 1px solid var(--glass-stroke);
		box-shadow: var(--glass-shadow);
		cursor: pointer;
		transition: transform 0.2s ease;
	}
	.map-btn:hover {
		transform: translateY(-1px);
	}

	/* Fullscreen / near-fullscreen exploration state. */
	.map-stage.fullscreen {
		position: fixed;
		top: var(--header-h);
		left: 0;
		right: 0;
		z-index: 25;
	}
	.scrim {
		position: fixed;
		inset: var(--header-h) 0 0 0;
		z-index: 24;
		border: 0;
		padding: 0;
		background: rgba(0, 0, 0, 0.4);
		cursor: pointer;
	}

	.glass-stack {
		position: relative;
		z-index: 1;
	}

	.content {
		max-width: 860px;
		margin: 0 auto;
		padding: 36px 40px;
		font-size: 14px;
		line-height: 1.6;
	}
	/* Glass content panel floating over the live map. */
	.content.glass {
		margin: 16px auto 48px;
		max-width: 892px;
		width: calc(100% - 32px);
		padding: 28px 32px;
		border-radius: 18px;
	}

	@media (max-width: 640px) {
		.content {
			padding: 24px 16px;
		}
		.content.glass {
			width: calc(100% - 20px);
			padding: 20px 16px;
			margin: 10px auto 36px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.map-btn {
			transition: none;
		}
	}
</style>
