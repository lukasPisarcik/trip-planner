<script lang="ts">
	import type { Trip } from '$lib/trips';
	import { Sidebar } from '$lib/components';
	import { aiPanelStore } from '$lib/stores';
	import { ChevronRight } from '@lucide/svelte';
	import Hero from './Hero.svelte';
	import TabBar from './TabBar.svelte';
	import TripMap, { hasGoogleMapsKey } from './TripMap.svelte';
	import { buildAllSpots, buildDayRoutes } from './tabs/mapLayers';
	import { tripKml } from '$lib/helpers/kml';
	import { overlayInsets } from '$lib/helpers/mapInsets';
	import ItineraryTab from './tabs/ItineraryTab.svelte';
	import TransportTab from './tabs/TransportTab.svelte';
	import ViralTab from './tabs/ViralTab.svelte';
	import FlightsTab from './tabs/FlightsTab.svelte';
	import BudgetTab from './tabs/BudgetTab.svelte';
	import TipsTab from './tabs/TipsTab.svelte';
	import RestaurantsTab from './tabs/RestaurantsTab.svelte';
	import AccommodationTab from './tabs/AccommodationTab.svelte';
	import BrainstormTab from './tabs/BrainstormTab.svelte';

	let { trip, viewerMode = false }: { trip: Trip; viewerMode?: boolean } = $props();

	const allTabs = [
		{ id: 'brainstorm', label: '💭 Brainstorm' },
		{ id: 'itinerary', label: '📅 Itinerary' },
		{ id: 'transport', label: '🚌 Transport' },
		{ id: 'viral', label: '📸 Viral Spots' },
		{ id: 'restaurants', label: '🍽️ Food & Drink' },
		{ id: 'accommodation', label: '🛏️ Stay' },
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
	// One persistent route layer per day with coordinates — all drawn on load.
	const dayRoutes = $derived(buildDayRoutes(trip));
	// Day key → palette token, so the itinerary cards' badges match their markers.
	const colorVars = $derived<Record<string, string>>(
		Object.fromEntries(dayRoutes.map((d) => [d.key, d.colorVar]))
	);
	// No coordinates anywhere (or no Google Maps API key configured) → no
	// backdrop; fall back to the solid hero banner + scrolling page.
	const hasMap = $derived(hasGoogleMapsKey && (layers.spots.length > 0 || dayRoutes.length > 0));

	// Single source of truth for the focused day (null = all-days view). The map
	// and the itinerary cards both read it and both can set it.
	let focusedKey = $state<string | null>(null);

	// A one-shot request for the itinerary to scroll a day's card into view. Set
	// only by map-initiated focus and cleared by the card once it has scrolled,
	// so a plain tab switch back to the itinerary never jumps the panel.
	let scrollRequest = $state<string | null>(null);

	/** Card-initiated focus (open/close a day card). */
	function setFocus(key: string | null) {
		focusedKey = key;
	}
	/** Map-initiated focus: also reveal the panel, surface and scroll to the day's card. */
	function focusFromMap(key: string | null) {
		focusedKey = key;
		if (key !== null) {
			active = 'itinerary';
			panelHidden = false;
			scrollRequest = key;
		}
	}
	function clearScrollRequest(key: string) {
		if (scrollRequest === key) scrollRequest = null;
	}

	// ── Stage geometry ──────────────────────────────────────────────────────────
	// The map is a fixed, viewport-sized canvas under everything; the sidebar,
	// title card and content panel float over it as glass. Nothing on the page
	// scrolls — only the panel body does. The map fits pad past every overlay
	// (see $lib/helpers/mapInsets) so no fitted marker lands under a card.
	const HEADER_H = 56; // the app header (h-14)
	const GAP = 12; // inset of every floating card
	const AI_PANEL_W = 392; // AiPanel card (380) + its 12px inset, when it reserves space (≥ lg)

	let panelHidden = $state(false);
	// Breakpoints the layout swaps on — mirrored from the Tailwind classes below.
	let isDesktop = $state(true); // ≥ 768px: panel docked right (else bottom sheet)
	let isWide = $state(true); // ≥ 1280px: 440px panel (else 400px)
	let isLg = $state(true); // ≥ 1024px: the AI panel reserves space (else overlays)
	let innerH = $state(800);
	// Measured height of the glass title card (px), bound from Hero.
	let titleHeight = $state(0);
	let mapRef = $state<ReturnType<typeof TripMap>>();

	const sidebar = Sidebar.useSidebar();

	const PANEL_W = $derived(isWide ? 440 : 400);
	const sheetH = $derived(Math.round(innerH * 0.55));
	const sidebarW = $derived(sidebar.isMobile ? 0 : sidebar.state === 'collapsed' ? 48 : 256);
	const insets = $derived(
		overlayInsets({
			desktop: isDesktop,
			headerHeight: HEADER_H,
			titleHeight,
			sidebarWidth: sidebarW,
			panelWidth: PANEL_W,
			panelHidden,
			sheetHeight: sheetH,
			aiPanelWidth: isLg && aiPanelStore.open && !viewerMode ? AI_PANEL_W : 0,
			gap: GAP
		})
	);

	/** Track a media query into a state setter; returns the unsubscribe. */
	function watchMedia(query: string, set: (matches: boolean) => void): () => void {
		const mq = window.matchMedia(query);
		set(mq.matches);
		const onChange = (e: MediaQueryListEvent) => set(e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}

	$effect(() => {
		if (!hasMap) return;
		const stop = [
			watchMedia('(min-width: 768px)', (m) => (isDesktop = m)),
			watchMedia('(min-width: 1280px)', (m) => (isWide = m)),
			watchMedia('(min-width: 1024px)', (m) => (isLg = m))
		];
		innerH = window.innerHeight;
		const onResize = () => (innerH = window.innerHeight);
		window.addEventListener('resize', onResize);
		return () => {
			for (const off of stop) off();
			window.removeEventListener('resize', onResize);
		};
	});

	// Escape brings a hidden panel back.
	$effect(() => {
		if (!panelHidden) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') panelHidden = false;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// ── KML export (Google My Maps hand-off) ────────────────────────────────────
	function downloadKml() {
		const blob = new Blob([tripKml(trip.title, layers.spots)], {
			type: 'application/vnd.google-earth.kml+xml'
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${trip.slug}.kml`;
		a.click();
		// Deferred: a same-task revoke can abort the download in Safari.
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	const styleVars = $derived(
		[
			`--trip-accent: var(--${trip.accent})`,
			`--trip-accent-lt: var(--${trip.accent}-lt)`,
			`--trip-accent-md: var(--${trip.accent}-md)`,
			`--trip-accent-strong: ${accentStrong[trip.accent]}`,
			`--header-h: ${HEADER_H}px`
		].join('; ')
	);

	const mapBtnClass =
		'glass inline-flex h-[34px] min-w-[34px] cursor-pointer items-center justify-center ' +
		'rounded-[10px] px-2.5 text-[15px] font-semibold text-(--ink) ' +
		'transition-transform hover:-translate-y-px motion-reduce:transition-none';
</script>

{#if hasMap}
	<!-- The stage: exactly one viewport tall under the header, so the document
	     never scrolls. overflow-clip (not hidden) keeps scrollIntoView inside the
	     panel from nudging the stage. --card-scroll-mt is zeroed: the panel body's
	     scroll-padding provides the 8px landing gap instead (Chromium ignores
	     scroll-margin on an overflow-hidden target such as a day card). -->
	<div
		class="relative h-[calc(100dvh-var(--header-h))] overflow-clip [--card-scroll-mt:0px]"
		style="{styleVars}; --panel-w: {PANEL_W}px"
	>
		<!-- Persistent, fixed, full-viewport canvas: mounted once, NEVER inside the
		     {#if active} switch, so switching tabs never remounts or reloads it. It
		     runs under the sidebar (z-10) and the app header (z-20). -->
		<TripMap
			class="fixed inset-0 z-0"
			{layers}
			days={dayRoutes}
			{focusedKey}
			onfocusday={focusFromMap}
			{insets}
			bind:this={mapRef}
		/>

		<!-- Title card -->
		<div class="absolute top-3 left-3 z-1 max-w-[55%] md:max-w-md">
			<Hero {trip} glass bind:overlayHeight={titleHeight} />
		</div>

		<!-- Control cluster: bottom of the map, left of the panel, on desktop (it
		     slides to the corner once the panel is hidden) — clear of the title
		     card at every width and of the attribution strip below the panel's
		     bottom gap. Top-right on phones, where the sheet covers the bottom. -->
		<div
			class="absolute z-1 flex gap-2 max-md:top-3 max-md:right-3 md:right-[calc(var(--panel-w)+24px)] md:bottom-6 md:data-[panel-hidden=true]:right-3"
			data-panel-hidden={panelHidden}
		>
			{#if focusedKey}
				<button type="button" class={mapBtnClass} onclick={() => setFocus(null)}
					>Show all days</button
				>
			{/if}
			<button
				type="button"
				class={mapBtnClass}
				aria-label="Zoom in"
				title="Zoom in"
				onclick={() => mapRef?.zoomBy(1)}>+</button
			>
			<button
				type="button"
				class={mapBtnClass}
				aria-label="Zoom out"
				title="Zoom out"
				onclick={() => mapRef?.zoomBy(-1)}>−</button
			>
			<button
				type="button"
				class={mapBtnClass}
				onclick={downloadKml}
				aria-label="Download all spots as KML"
				title="Download KML — import into Google My Maps (mymaps.google.com) to open every spot in the Google Maps app"
			>
				⬇
			</button>
			{#if panelHidden}
				<button
					type="button"
					class="{mapBtnClass} max-md:hidden"
					aria-controls="trip-panel"
					aria-expanded="false"
					onclick={() => (panelHidden = false)}>Show panel</button
				>
			{/if}
		</div>
		<!-- Phone restore button sits where the sheet was. -->
		{#if panelHidden}
			<button
				type="button"
				class="{mapBtnClass} absolute right-3 bottom-3 z-1 md:hidden"
				aria-controls="trip-panel"
				aria-expanded="false"
				onclick={() => (panelHidden = false)}>Show panel</button
			>
		{/if}

		<!-- Content panel: a glass card docked right (≥ md) or a bottom sheet
		     (phones). Hidden → slides off-screen and goes inert so keyboard focus
		     can't land in it. -->
		<aside
			id="trip-panel"
			class="glass absolute z-1 flex flex-col overflow-hidden rounded-[18px] text-[13px] leading-relaxed transition-transform duration-300 motion-reduce:transition-none max-md:inset-x-3 max-md:bottom-3 max-md:h-[55dvh] max-md:data-[hidden=true]:translate-y-[calc(100%+12px)] md:top-3 md:right-3 md:bottom-6 md:w-(--panel-w) md:data-[hidden=true]:translate-x-[calc(100%+12px)]"
			data-hidden={panelHidden}
			inert={panelHidden}
		>
			<!-- Frosted header band: the hide chevron (left edge on desktop, a
			     centred handle above the strip on phones) + the compact tab strip. -->
			<div class="flex shrink-0 max-md:flex-col">
				<button
					type="button"
					class="flex shrink-0 cursor-pointer items-center justify-center border-(--glass-stroke) bg-(--glass-bg) text-(--ink3) backdrop-blur-[var(--glass-blur)] backdrop-saturate-160 transition-colors hover:text-(--ink) max-md:h-5 max-md:w-full md:w-7 md:border-r md:border-b"
					aria-label="Hide panel"
					aria-controls="trip-panel"
					aria-expanded="true"
					onclick={() => (panelHidden = true)}
				>
					<ChevronRight class="size-4 max-md:rotate-90" />
				</button>
				<div class="min-w-0 flex-1">
					<TabBar {tabs} {active} onselect={(id) => (active = id)} compact />
				</div>
			</div>
			<div
				class="min-h-0 flex-1 scroll-pt-2 overflow-y-auto overscroll-contain px-4 py-4 [--card-fill-sky:transparent] [--card-fill-soft:transparent] [--card-fill:transparent] [--trip-shadow:0_0_0_1px_var(--glass-stroke)]"
			>
				{#if active === 'brainstorm'}
					<BrainstormTab slug={trip.slug} content={trip.brainstorm} />
				{:else if active === 'itinerary'}
					<ItineraryTab
						data={trip.itinerary}
						{focusedKey}
						{colorVars}
						onfocuschange={setFocus}
						{scrollRequest}
						onscrolled={clearScrollRequest}
					/>
				{:else if active === 'transport'}
					<TransportTab data={trip.transport} />
				{:else if active === 'viral'}
					<ViralTab data={trip.viral} />
				{:else if active === 'restaurants'}
					<RestaurantsTab data={trip.restaurants} />
				{:else if active === 'accommodation'}
					<AccommodationTab data={trip.accommodation} />
				{:else if active === 'flights'}
					<FlightsTab data={trip.flights} />
				{:else if active === 'budget'}
					<BudgetTab data={trip.budget} />
				{:else if active === 'tips'}
					<TipsTab data={trip.tips} />
				{/if}
			</div>
		</aside>
	</div>
{:else}
	<!-- No coordinates / no Maps key: the solid banner + sticky tab bar + a
	     normally scrolling page. -->
	<div class="relative" style={styleVars}>
		<Hero {trip} />
		<div class="relative z-1">
			<TabBar {tabs} {active} onselect={(id) => (active = id)} />
			<div class="mx-auto max-w-[860px] px-10 py-9 text-sm leading-relaxed max-sm:px-4 max-sm:py-6">
				{#if active === 'brainstorm'}
					<BrainstormTab slug={trip.slug} content={trip.brainstorm} />
				{:else if active === 'itinerary'}
					<ItineraryTab data={trip.itinerary} />
				{:else if active === 'transport'}
					<TransportTab data={trip.transport} />
				{:else if active === 'viral'}
					<ViralTab data={trip.viral} />
				{:else if active === 'restaurants'}
					<RestaurantsTab data={trip.restaurants} />
				{:else if active === 'accommodation'}
					<AccommodationTab data={trip.accommodation} />
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
{/if}
