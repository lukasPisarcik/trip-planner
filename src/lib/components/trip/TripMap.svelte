<script lang="ts" module>
	import { env as publicEnv } from '$env/dynamic/public';

	// Documented public-env exception (like PUBLIC_CONVEX_URL): the browser itself
	// loads the Maps JS API, so the key must ship to the client. Read here ONLY —
	// see .claude/docs/environment-variables.md. Key absent → the caller renders
	// the solid-hero fallback (hasGoogleMapsKey below).
	const GOOGLE_MAPS_API_KEY = publicEnv.PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
	// Advanced Markers need a vector Map ID; DEMO_MAP_ID works for local testing.
	const GOOGLE_MAPS_MAP_ID = publicEnv.PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

	/** False when no PUBLIC_GOOGLE_MAPS_API_KEY is configured — no map can render. */
	export const hasGoogleMapsKey = GOOGLE_MAPS_API_KEY.length > 0;

	// setOptions must run exactly once, before the first importLibrary call.
	let loaderConfigured = false;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
	import { themeStore } from '$lib/stores';
	import { gmapsSearchUrl } from '$lib/helpers/gmaps';
	import type { MapLayers, SpotCategory, DayFocus, BoundsTuple } from './tabs/mapLayers';
	import { boundsOf } from './tabs/mapLayers';

	let {
		layers,
		height,
		interactive = false,
		fullscreen = false,
		hiddenTop = 0,
		topOverlay = 0,
		class: className = ''
	}: {
		/** The constant marker set (all coord-bearing spots). */
		layers: MapLayers;
		/** Container height in px; changes only on resize/fullscreen. */
		height: number;
		/** Pan/zoom enabled (expanded or fullscreen) vs. a static backdrop (collapsed). */
		interactive?: boolean;
		/** Fullscreen stage — one-finger pan allowed ('greedy' vs 'cooperative'). */
		fullscreen?: boolean;
		/**
		 * Px of the map's top edge scrolled out of view (the stage slides under the
		 * app header until only a peek remains). Read at fit time so focus/reset
		 * target the still-visible bottom slice of the canvas.
		 */
		hiddenTop?: number;
		/** Px the glass hero overlays the map's top — fits pad past it so pins stay visible. */
		topOverlay?: number;
		class?: string;
	} = $props();

	// Per-category pin colour, resolved from the theme-aware tokens at draw time.
	const CATEGORY_VAR: Record<SpotCategory, string> = {
		activity: '--sage',
		restaurant: '--amber',
		viral: '--fire',
		stay: '--violet'
	};

	const PIN_CLASS =
		'flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white ' +
		'bg-(--pin) text-[10px] leading-none shadow-[0_1px_4px_rgba(0,0,0,0.4)]';
	const ROUTE_PIN_CLASS =
		'flex h-7 w-7 items-center justify-center rounded-full border-2 border-white ' +
		'bg-(--trip-accent) text-[13px] leading-none font-bold text-white ' +
		'shadow-[0_1px_5px_rgba(0,0,0,0.45)]';

	let mapEl: HTMLDivElement;
	let map: google.maps.Map | null = null;
	let info: google.maps.InfoWindow | null = null;
	let MapCtor: typeof google.maps.Map | null = null;
	let InfoWindowCtor: typeof google.maps.InfoWindow | null = null;
	let AdvancedMarker: typeof google.maps.marker.AdvancedMarkerElement | null = null;
	let spotMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
	let routeMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
	let routeLines: google.maps.Polyline[] = [];
	// Reapplied after a theme flip re-creates the map (colorScheme is init-only).
	let currentFocus: DayFocus | null = null;
	let ready = $state(false);

	function cssVar(name: string, fallback: string): string {
		if (!mapEl) return fallback;
		return getComputedStyle(mapEl).getPropertyValue(name).trim() || fallback;
	}

	const allBounds = $derived(boundsOf(layers.spots));

	function toLatLngBounds(b: BoundsTuple): google.maps.LatLngBounds {
		return new google.maps.LatLngBounds(
			{ lat: b[0][0], lng: b[0][1] },
			{ lat: b[1][0], lng: b[1][1] }
		);
	}

	/**
	 * Fit paddings that respect the overlays: the glass hero covers the top
	 * (`topOverlay`) and, when the page is scrolled, the visible window is the
	 * BOTTOM slice of the canvas, so the top padding also grows by `hiddenTop`.
	 */
	function fitPadding(base: number): google.maps.Padding {
		const inset = hiddenTop > 0 ? 12 : base;
		// Clamp: hiddenTop + hero can exceed the canvas on short/scrolled
		// viewports, and padding beyond the canvas makes fitBounds degenerate —
		// always leave at least a 120px band for the bounds themselves.
		const top = Math.min(hiddenTop + inset + topOverlay, Math.max(0, height - inset - 120));
		return { top, bottom: inset, left: base, right: base };
	}

	/** fitBounds has no maxZoom option — clamp once the camera settles. Only one
	 * clamp may be pending: a second fit (focus → reset) replaces the first, so a
	 * stale listener can't re-clamp the newer viewport with the older limit. */
	let zoomClampListener: google.maps.MapsEventListener | null = null;
	function clampZoom(max: number) {
		if (!map) return;
		zoomClampListener?.remove();
		zoomClampListener = google.maps.event.addListenerOnce(map, 'idle', () => {
			zoomClampListener = null;
			if (map && (map.getZoom() ?? 0) > max) map.setZoom(max);
		});
	}

	/** Bounds of every spot, fit. */
	function fitAll() {
		if (!map || !allBounds) return;
		map.fitBounds(toLatLngBounds(allBounds), fitPadding(48));
		clampZoom(14);
	}

	/** One-finger scroll must never pan the inline map; fullscreen may grab it. */
	function gestureFor(): string {
		if (!interactive) return 'none';
		return fullscreen ? 'greedy' : 'cooperative';
	}

	/** Info-window content: name + an "Open in Google Maps" hand-off link.
	 * `display` may carry a route number ("3. Meiji Shrine"); `placeName` is the
	 * raw name the link searches for, anchored at the coords, so Google opens the
	 * actual place listing instead of a bare dropped pin. */
	function infoContent(
		display: string,
		icon: string | undefined,
		pos: google.maps.LatLngLiteral,
		placeName: string
	) {
		const wrap = document.createElement('div');
		wrap.className = 'flex flex-col gap-1 pr-1 text-[12.5px] leading-[1.45] text-(--ink)';
		const name = document.createElement('div');
		name.className = 'font-semibold';
		name.textContent = icon ? `${icon} ${display}` : display;
		const link = document.createElement('a');
		link.href = gmapsSearchUrl({ coords: pos, name: placeName }) ?? '#';
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = 'Open in Google Maps ↗';
		link.className = 'font-medium text-(--sky) no-underline hover:underline';
		wrap.append(name, link);
		return wrap;
	}

	function openInfo(
		anchor: google.maps.marker.AdvancedMarkerElement,
		display: string,
		icon: string | undefined,
		pos: google.maps.LatLngLiteral,
		placeName: string
	) {
		if (!info || !map) return;
		info.setContent(infoContent(display, icon, pos, placeName));
		info.open({ map, anchor });
	}

	// The layers object markers were last drawn from — lets the spots $effect
	// skip its first run right after init (createMap already drew them).
	let lastDrawnLayers: MapLayers | null = null;

	/** Plot the constant all-spots marker set. */
	function drawSpots() {
		if (!map || !AdvancedMarker) return;
		lastDrawnLayers = layers;
		for (const m of spotMarkers) m.map = null;
		spotMarkers = [];
		for (const spot of layers.spots) {
			const pos = { lat: spot.lat, lng: spot.lng };
			const pin = document.createElement('span');
			pin.className = PIN_CLASS;
			pin.style.setProperty('--pin', cssVar(CATEGORY_VAR[spot.category], '#4a7c59'));
			pin.textContent = spot.icon ?? '';
			const marker = new AdvancedMarker({
				map,
				position: pos,
				content: pin,
				title: spot.title,
				gmpClickable: true
			});
			marker.addListener('click', () => openInfo(marker, spot.title, spot.icon, pos, spot.title));
			spotMarkers.push(marker);
		}
	}

	function clearRoute() {
		for (const m of routeMarkers) m.map = null;
		routeMarkers = [];
		for (const l of routeLines) l.setMap(null);
		routeLines = [];
		info?.close();
	}

	/** Draw a day's dotted route + numbered stops (and optionally fly to them). */
	function drawFocus(f: DayFocus, fit: boolean) {
		if (!map || !AdvancedMarker) return;
		clearRoute();
		const accent = cssVar('--trip-accent', '#4a7c59');
		for (const seg of f.segments) {
			if (seg.length >= 2) {
				routeLines.push(
					new google.maps.Polyline({
						map,
						path: seg.map((p) => ({ lat: p.lat, lng: p.lng })),
						// Dotted route: the stroke itself is invisible; repeated circle
						// symbols draw the dots.
						strokeOpacity: 0,
						icons: [
							{
								icon: {
									path: google.maps.SymbolPath.CIRCLE,
									scale: 2.5,
									fillColor: accent,
									fillOpacity: 0.9,
									strokeOpacity: 0
								},
								offset: '0',
								repeat: '11px'
							}
						]
					})
				);
			}
			for (const p of seg) {
				const pos = { lat: p.lat, lng: p.lng };
				const pin = document.createElement('span');
				pin.className = ROUTE_PIN_CLASS;
				pin.textContent = String(p.n);
				const marker = new AdvancedMarker({
					map,
					position: pos,
					content: pin,
					title: `${p.n}. ${p.title}`,
					zIndex: 1000,
					gmpClickable: true
				});
				marker.addListener('click', () =>
					openInfo(marker, `${p.n}. ${p.title}`, p.icon, pos, p.title)
				);
				routeMarkers.push(marker);
			}
		}
		if (f.bounds && fit) {
			map.fitBounds(toLatLngBounds(f.bounds), fitPadding(56));
			clampZoom(16);
		}
	}

	/**
	 * Fly the backdrop to a single day's stops and draw its highlighted route.
	 * The marker set is unchanged — only the viewport + the transient route layer.
	 */
	export function focus(f: DayFocus) {
		currentFocus = f;
		drawFocus(f, true);
	}

	/** Clear any day highlight and return to the all-spots view. */
	export function reset() {
		currentFocus = null;
		clearRoute();
		fitAll();
	}

	/** Build (or rebuild, on theme flip) the map instance and all overlays. */
	function createMap(view?: { center: google.maps.LatLngLiteral; zoom: number }) {
		if (!MapCtor || !InfoWindowCtor || !mapEl) return;
		// A pending clamp belongs to the previous instance — drop it.
		zoomClampListener?.remove();
		zoomClampListener = null;
		map = new MapCtor(mapEl, {
			mapId: GOOGLE_MAPS_MAP_ID,
			// Init-only — a theme flip tears the instance down and rebuilds it here.
			colorScheme:
				themeStore.current === 'dark'
					? google.maps.ColorScheme.DARK
					: google.maps.ColorScheme.LIGHT,
			backgroundColor: cssVar('--cream', '#faf7f2'),
			disableDefaultUI: true,
			zoomControl: interactive,
			zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
			gestureHandling: gestureFor(),
			clickableIcons: false,
			center: view?.center ?? { lat: 20, lng: 0 },
			zoom: view?.zoom ?? 2
		});
		info = new InfoWindowCtor();
		drawSpots();
		if (currentFocus) drawFocus(currentFocus, false);
		if (!view) {
			if (allBounds) fitAll();
			// No spots and no carried-over view → neutral world view (caller hides it anyway).
		}
	}

	onMount(() => {
		if (!hasGoogleMapsKey) return; // keyless build — caller shows the solid hero instead
		let destroyed = false;

		(async () => {
			if (!loaderConfigured) {
				setOptions({ key: GOOGLE_MAPS_API_KEY, v: 'weekly' });
				loaderConfigured = true;
			}
			const [mapsLib, markerLib] = await Promise.all([
				importLibrary('maps'),
				importLibrary('marker')
			]);
			if (destroyed || !mapEl) return;
			MapCtor = mapsLib.Map;
			InfoWindowCtor = mapsLib.InfoWindow;
			AdvancedMarker = markerLib.AdvancedMarkerElement;
			createMap();
			ready = true;
		})().catch((e) => {
			// Invalid/exhausted key or blocked network — stay on the cream backdrop
			// instead of surfacing an unhandled rejection.
			console.warn('Google Maps failed to load — map backdrop disabled.', e);
		});

		return () => {
			destroyed = true;
			clearRoute();
			zoomClampListener?.remove();
			zoomClampListener = null;
			for (const m of spotMarkers) m.map = null;
			spotMarkers = [];
			info = null;
			map = null;
			ready = false;
		};
	});

	// Rebuild markers if the trip's spots change (e.g. a co-pilot edit), without
	// yanking the viewport — only refit when we go from empty to populated.
	// Reading `layers` here registers it as a dependency; the identity check
	// skips the first run after init (createMap already drew this set).
	$effect(() => {
		const next = layers;
		if (!ready || next === lastDrawnLayers) return;
		const hadNone = spotMarkers.length === 0;
		drawSpots();
		if (hadNone && allBounds) fitAll();
	});

	// Follow the app's light/dark toggle. colorScheme is init-only in the Maps JS
	// API, so flipping the theme re-creates the map, carrying the view state over.
	// The API has no destroy(), so the old instance is only dereferenced — a slow
	// leak on repeated toggling that the Maps JS API simply doesn't let us avoid.
	let lastTheme = themeStore.current;
	$effect(() => {
		const theme = themeStore.current;
		if (!ready || theme === lastTheme) {
			lastTheme = theme;
			return;
		}
		lastTheme = theme;
		const center = map?.getCenter()?.toJSON();
		const zoom = map?.getZoom();
		createMap(center && zoom != null ? { center, zoom } : undefined);
	});

	// Static backdrop when collapsed; cooperative inline / greedy fullscreen.
	$effect(() => {
		const gestureHandling = gestureFor();
		const zoomControl = interactive;
		if (ready) map?.setOptions({ gestureHandling, zoomControl });
	});
</script>

<!-- relative + isolate contain the map DOM in its own stacking context, so it
     doesn't paint over the glass hero / controls. Non-interactive backdrop gets
     pointer-events:none so page scroll passes through. -->
<div
	class="trip-map relative isolate w-full overflow-hidden bg-(--cream) {className}"
	class:pointer-events-auto={interactive}
	class:pointer-events-none={!interactive}
	style="height: {height}px"
	bind:this={mapEl}
	role="region"
	aria-label="Map of the trip's spots"
></div>

<!-- Google-injected DOM only (info-window chrome) — utilities can't reach
     runtime-injected elements, so theme its surfaces with the design tokens. -->
<style>
	.trip-map :global(.gm-style .gm-style-iw-c) {
		background: var(--white);
	}
	.trip-map :global(.gm-style .gm-style-iw-d) {
		overflow: hidden !important;
	}
	.trip-map :global(.gm-style .gm-style-iw-tc::after) {
		background: var(--white);
	}
</style>
