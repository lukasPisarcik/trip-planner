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
	// The stage's layout height is CONSTANT — it scrolls away naturally (sticky
	// with a negative top, see .map-stage) until only the COLLAPSED peek stays
	// pinned under the header. Never tie this to scrollY: shrinking the sticky
	// stage per scroll frame resizes the document mid-scroll (scroll-anchoring
	// feedback loop) and forces Leaflet to re-tile every frame.
	const mapHeight = $derived(fullscreen ? Math.round(innerH * 0.88) : expanded);
	// How much of the map's top has scrolled out of view — lets fitBounds target
	// the still-visible bottom slice when a day is focused from a scrolled page.
	const hiddenTop = $derived(fullscreen ? 0 : Math.max(0, Math.min(scrollY, expanded - COLLAPSED)));
	// Past the collapse point the hero condenses and the map goes static.
	const scrolled = $derived(!fullscreen && scrollY > (expanded - COLLAPSED) * 0.6);
	// Pan/zoom only when there's room to interact (top of page or fullscreen).
	const interactive = $derived(fullscreen || (!scrolled && hasMap));

	function toggleFullscreen() {
		fullscreen = !fullscreen;
	}

	// rAF-throttled window scroll → scrollY, which only drives cheap state (the
	// `scrolled` boolean + `hiddenTop`) — never layout. Also tracks viewport height.
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

	// The stage stacks the map, glass hero and controls in one grid cell. Normal
	// mode: sticky with a NEGATIVE top so it scrolls away naturally, sticking once
	// only the COLLAPSED peek shows under the header. z-2 keeps the opaque peek
	// above the content column (z-1), so scrolled content slides in behind it.
	const stageClass = $derived(
		'grid *:col-start-1 *:row-start-1 *:min-w-0 bg-(--cream) ' +
			(fullscreen ? 'fixed inset-x-0 top-(--header-h) z-25' : 'sticky top-(--map-peek-top) z-2')
	);

	const mapBtnClass =
		'glass pointer-events-auto inline-flex h-[34px] min-w-[34px] cursor-pointer items-center ' +
		'justify-center rounded-[10px] px-2.5 text-[15px] font-semibold text-(--ink) ' +
		'transition-transform hover:-translate-y-px motion-reduce:transition-none';

	const contentClass = $derived(
		hasMap
			? // Glass content panel floating over the live map.
				'glass mx-auto mt-4 mb-12 w-[calc(100%-32px)] max-w-[892px] rounded-[18px] px-8 py-7 ' +
					'text-sm leading-relaxed max-sm:mt-2.5 max-sm:mb-9 max-sm:w-[calc(100%-20px)] max-sm:px-4 max-sm:py-5'
			: 'mx-auto max-w-[860px] px-10 py-9 text-sm leading-relaxed max-sm:px-4 max-sm:py-6'
	);
</script>

<div class="relative" style={styleVars}>
	{#if hasMap}
		<!-- Persistent backdrop: mounted once, NEVER inside the {#if active} switch,
		     so switching tabs never remounts or reloads it. -->
		<div
			class={stageClass}
			style="height: {mapHeight}px; --map-peek-top: {HEADER_H + COLLAPSED - expanded}px"
		>
			<TripMap bind:this={tripMap} {layers} height={mapHeight} {interactive} {hiddenTop} />
			<Hero {trip} glass compact={scrolled} />
			<!-- Controls ride the peek: sticky below the header, like the hero. -->
			<div
				class="pointer-events-none sticky top-(--header-h) z-3 flex gap-2 self-start justify-self-end p-3"
			>
				{#if focusedKey}
					<button type="button" class={mapBtnClass} onclick={showAll}>Show all spots</button>
				{/if}
				<button
					type="button"
					class={mapBtnClass}
					onclick={toggleFullscreen}
					aria-label={fullscreen ? 'Close expanded map' : 'Expand map'}
					title={fullscreen ? 'Close' : 'Expand map'}
				>
					{fullscreen ? '✕' : '⤢'}
				</button>
			</div>
		</div>
		{#if fullscreen}
			<button
				type="button"
				class="fixed inset-x-0 top-(--header-h) bottom-0 z-24 cursor-pointer border-0 bg-black/40 p-0"
				aria-label="Close expanded map"
				onclick={toggleFullscreen}
			></button>
		{/if}
	{:else}
		<Hero {trip} />
	{/if}

	<!-- While the map is fullscreen, take the content behind the scrim out of the
	     tab order + a11y tree so keyboard focus can't land on hidden controls. -->
	<div class="relative z-1" inert={fullscreen} aria-hidden={fullscreen}>
		<TabBar {tabs} {active} onselect={(id) => (active = id)} glass={hasMap} />

		<div class={contentClass}>
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
