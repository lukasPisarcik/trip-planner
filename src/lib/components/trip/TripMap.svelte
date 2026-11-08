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

	// Routes Essentials SKU: origin + ≤ 10 intermediates + destination per request.
	const MAX_STOPS_PER_REQUEST = 12;
	// Stop photo tiles are 44px; ask Wikimedia for a ≤ 96px thumb (2× for HiDPI).
	const TILE_THUMB_PX = 96;
	// Opacity of every non-focused day (routes + markers) and of the category pins.
	// Keep in step with DIM_CLASS below (the marker-DOM half of the same state).
	const DIM = 0.25;
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
	import { themeStore } from '$lib/stores';
	import { gmapsSearchUrl } from '$lib/helpers/gmaps';
	import { createRouteCache, type PathPoint, type RouteCache } from '$lib/helpers/routeCache';
	import { wikiThumb } from '$lib/helpers/wikiThumb';
	import type { MapLayers, SpotCategory, BoundsTuple, DayRoute, DayStop } from './tabs/mapLayers';
	import { boundsOf, chunkStops, routeCacheKey } from './tabs/mapLayers';

	let {
		layers,
		days,
		focusedKey = null,
		onfocusday,
		height,
		interactive = false,
		fullscreen = false,
		hiddenTop = 0,
		topOverlay = 0,
		class: className = ''
	}: {
		/** The constant marker set — only its non-activity categories are drawn as
		 * pins (activities are the day layers' photo markers). */
		layers: MapLayers;
		/** One persistent route layer per day with coordinates (see buildDayRoutes). */
		days: DayRoute[];
		/** Key of the focused day (`DayRoute.key`), or null for the all-days view. */
		focusedKey?: string | null;
		/** Map-initiated focus change (marker / route / empty-map click). */
		onfocusday?: (key: string | null) => void;
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
		'bg-(--pin) text-[10px] leading-none shadow-[0_1px_4px_rgba(0,0,0,0.4)] ' +
		'transition-opacity duration-200 motion-reduce:transition-none';
	// Photo tile: rounded square in the day colour; the img (if any) covers it.
	// Its size (and the badge's) comes from CSS variables set on the map
	// container per zoom tier (see applyZoomTier), so tiles shrink as you zoom
	// out instead of piling into an unreadable cluster.
	const TILE_CLASS =
		'relative flex size-(--tile) items-center justify-center rounded-[27%] border-2 border-white ' +
		'bg-(--day) text-(length:--tile-font) leading-none shadow-[0_2px_8px_rgba(0,0,0,0.35)] ' +
		'transition-opacity duration-200 motion-reduce:transition-none';
	const TILE_IMG_CLASS = 'h-full w-full rounded-[22%] object-cover';
	// Order badge riding the tile's top-right corner.
	const BADGE_CLASS =
		'absolute -top-1.5 -right-1.5 flex h-(--badge) min-w-(--badge) items-center justify-center ' +
		'rounded-full border-2 border-white bg-(--day) px-1 text-(length:--badge-font) leading-none ' +
		'font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]';

	/** Marker/line sizing per zoom level — city-level zoom gets the full 44px
	 * photo tile and a 4px stroke; zoomed-out views shrink both. */
	interface ZoomTier {
		tile: number;
		tileFont: number;
		badge: number;
		badgeFont: number;
		stroke: number;
		casing: number;
	}
	const TIER_NEAR: ZoomTier = {
		tile: 44,
		tileFont: 20,
		badge: 20,
		badgeFont: 11,
		stroke: 4,
		casing: 7
	};
	const TIER_MID: ZoomTier = {
		tile: 30,
		tileFont: 14,
		badge: 16,
		badgeFont: 10,
		stroke: 3,
		casing: 5
	};
	const TIER_FAR: ZoomTier = {
		tile: 20,
		tileFont: 10,
		badge: 14,
		badgeFont: 9,
		stroke: 2,
		casing: 4
	};
	function zoomTier(zoom: number): ZoomTier {
		if (zoom >= 14) return TIER_NEAR;
		if (zoom >= 12) return TIER_MID;
		return TIER_FAR;
	}
	// Svelte state so the variables ride the container's `style` binding below:
	// an imperative style.setProperty would be wiped whenever `height` changes.
	let tier = $state.raw<ZoomTier>(TIER_NEAR);
	const DIM_CLASS = 'opacity-25'; // = DIM, as a Tailwind utility for marker DOM

	interface SpotMarker {
		marker: google.maps.marker.AdvancedMarkerElement;
		content: HTMLElement;
	}
	interface DayMarker {
		marker: google.maps.marker.AdvancedMarkerElement;
		content: HTMLElement;
	}
	/** One drawn run of ≤ 12 stops: a dashed straight fallback that stays until
	 * (and unless) the road path arrives, then a white casing + coloured stroke. */
	interface SegmentLayer {
		stops: DayStop[];
		fallback: google.maps.Polyline;
		casing: google.maps.Polyline | null;
		stroke: google.maps.Polyline | null;
	}
	interface DayLayer {
		key: string;
		colorVar: string;
		markers: DayMarker[];
		segments: SegmentLayer[];
	}

	let mapEl: HTMLDivElement;
	let probeEl: HTMLSpanElement;
	let map: google.maps.Map | null = null;
	let info: google.maps.InfoWindow | null = null;
	let MapCtor: typeof google.maps.Map | null = null;
	let InfoWindowCtor: typeof google.maps.InfoWindow | null = null;
	let AdvancedMarker: typeof google.maps.marker.AdvancedMarkerElement | null = null;
	let RouteCtor: typeof google.maps.routes.Route | null = null;
	let spotMarkers: SpotMarker[] = [];
	let dayLayers: DayLayer[] = [];
	// Bumped on every drawDays(); a route result from an older draw is dropped.
	let generation = 0;
	let ready = $state(false);

	/**
	 * Resolve a design token to an rgb() string Maps can consume (it can't read
	 * CSS variables, and --primary is stored as bare HSL channels): paint the
	 * token onto a hidden probe and read the computed colour back.
	 */
	function resolveColor(varName: string, fallback: string): string {
		if (!probeEl) return fallback;
		probeEl.style.backgroundColor = `var(${varName})`;
		const rgb = getComputedStyle(probeEl).backgroundColor;
		return rgb && rgb !== 'rgba(0, 0, 0, 0)' ? rgb : fallback;
	}
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

	/** Fit the viewport to one day's stops. */
	function fitDay(key: string) {
		const day = days.find((d) => d.key === key);
		if (!map || !day?.bounds) return;
		map.fitBounds(toLatLngBounds(day.bounds), fitPadding(56));
		clampZoom(16);
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

	// ── Category pins (restaurants, viral spots, stays) ─────────────────────────

	// The layers object markers were last drawn from — lets the spots $effect
	// skip its first run right after init (createMap already drew them).
	let lastDrawnLayers: MapLayers | null = null;

	/** Plot the constant non-activity marker set (activities are day markers). */
	function drawSpots() {
		if (!map || !AdvancedMarker) return;
		lastDrawnLayers = layers;
		for (const m of spotMarkers) m.marker.map = null;
		spotMarkers = [];
		for (const spot of layers.spots) {
			if (spot.category === 'activity') continue;
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
			spotMarkers.push({ marker, content: pin });
		}
	}

	// ── Day layers: photo markers + driving routes ──────────────────────────────

	/** 44px photo tile (or emoji tile) with the stop's order badge. */
	function photoPin(stop: DayStop, dayKey: string, color: string): HTMLElement {
		const tile = document.createElement('div');
		tile.className = TILE_CLASS;
		tile.style.setProperty('--day', color);
		tile.dataset.dayMarker = dayKey;
		const emoji = document.createElement('span');
		emoji.textContent = stop.icon ?? '';
		if (stop.imageUrl) {
			const img = document.createElement('img');
			img.src = wikiThumb(stop.imageUrl, TILE_THUMB_PX);
			img.alt = '';
			img.loading = 'lazy';
			img.referrerPolicy = 'no-referrer';
			img.className = TILE_IMG_CLASS;
			// A dead hotlink falls back to the emoji tile instead of a broken image.
			img.addEventListener('error', () => img.replaceWith(emoji), { once: true });
			tile.append(img);
		} else {
			tile.append(emoji);
		}
		const badge = document.createElement('span');
		badge.className = BADGE_CLASS;
		badge.textContent = String(stop.n);
		tile.append(badge);
		return tile;
	}

	/** Dashed straight-line symbol sequence for pending / unroutable segments. */
	function dashIcons(opacity: number): google.maps.IconSequence[] {
		return [
			{
				icon: { path: 'M 0,-1 0,1', strokeOpacity: opacity, scale: 3 },
				offset: '0',
				repeat: '14px'
			}
		];
	}

	// Memory + localStorage cache of computed paths, created lazily in the browser.
	let routeCache: RouteCache | null = null;
	function cache(): RouteCache {
		if (routeCache) return routeCache;
		let storage: Storage | null = null;
		try {
			storage = typeof localStorage === 'undefined' ? null : localStorage;
		} catch {
			// Storage access can throw (disabled cookies / sandboxed frames) — memory only.
		}
		routeCache = createRouteCache(storage);
		return routeCache;
	}

	// Plain, non-reactive bookkeeping (read inside drawDays, which runs from
	// $effects — a SvelteMap/SvelteSet here would register spurious dependencies).
	// In-flight requests by cache key, so a theme rebuild mid-request reuses the
	// pending promise instead of spending a second route request.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pending = new Map<string, Promise<PathPoint[]>>();
	// Keys whose request failed this page load: never re-requested until a reload,
	// so a theme flip or itinerary edit can't re-spend a doomed (billable) call.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const failed = new Set<string>();
	// Warn once per failed segment — a 21-day trip must not flood the console.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const warned = new Set<string>();

	/** Road-following path through `stops` via the Routes library (DRIVING). */
	async function computePath(stops: DayStop[]): Promise<PathPoint[]> {
		if (!RouteCtor) throw new Error('Routes library not loaded');
		const toLiteral = (p: DayStop): google.maps.LatLngLiteral => ({ lat: p.lat, lng: p.lng });
		const { routes } = await RouteCtor.computeRoutes({
			origin: toLiteral(stops[0]),
			destination: toLiteral(stops[stops.length - 1]),
			intermediates: stops.slice(1, -1).map((p) => ({ location: toLiteral(p) })),
			travelMode: 'DRIVING',
			fields: ['path']
		});
		const path = routes?.[0]?.path;
		if (!path || path.length < 2) throw new Error('No route returned');
		return path.map((p) => ({ lat: p.lat, lng: p.lng }));
	}

	/** Cached-or-fetched path for a run of stops; the promise is shared across draws. */
	function pathFor(key: string, stops: DayStop[]): Promise<PathPoint[]> {
		if (failed.has(key)) return Promise.reject(new Error('Route previously unavailable'));
		let p = pending.get(key);
		if (!p) {
			p = computePath(stops)
				.then((path) => {
					cache().set(key, path);
					return path;
				})
				.catch((e: unknown) => {
					failed.add(key);
					throw e;
				})
				.finally(() => pending.delete(key));
			pending.set(key, p);
		}
		return p;
	}

	/** Replace a segment's dashed fallback with the solid casing + stroke. */
	function drawSolid(seg: SegmentLayer, path: PathPoint[], color: string, dim: boolean, z: number) {
		if (!map) return;
		const mult = dim ? DIM : 1;
		seg.fallback.setMap(null);
		const t = untrack(() => tier); // drawDays runs inside $effects — don't subscribe
		seg.casing = new google.maps.Polyline({
			map,
			path,
			clickable: true,
			strokeColor: '#ffffff',
			strokeOpacity: 0.55 * mult,
			strokeWeight: t.casing,
			zIndex: z
		});
		seg.stroke = new google.maps.Polyline({
			map,
			path,
			clickable: true,
			strokeColor: color,
			strokeOpacity: 0.95 * mult,
			strokeWeight: t.stroke,
			zIndex: z + 1
		});
	}

	/** Re-size tiles (via CSS variables the marker DOM inherits from the map
	 * container) and line weights for the current zoom. */
	function applyZoomTier() {
		if (!map || !mapEl) return;
		const next = zoomTier(map.getZoom() ?? 14);
		if (next === untrack(() => tier)) return;
		tier = next;
		for (const layer of dayLayers) {
			for (const s of layer.segments) {
				s.casing?.setOptions({ strokeWeight: tier.casing });
				s.stroke?.setOptions({ strokeWeight: tier.stroke });
			}
		}
	}

	function clearDays() {
		for (const layer of dayLayers) {
			for (const m of layer.markers) m.marker.map = null;
			for (const s of layer.segments) {
				s.fallback.setMap(null);
				s.casing?.setMap(null);
				s.stroke?.setMap(null);
			}
		}
		dayLayers = [];
		info?.close();
	}

	// The days array markers were last drawn from (identity check, like spots).
	let lastDrawnDays: DayRoute[] | null = null;

	/** Draw every day: photo markers + one route per ≤12-stop run of each segment. */
	function drawDays() {
		if (!map || !AdvancedMarker) return;
		lastDrawnDays = days;
		clearDays();
		generation += 1;
		const gen = generation;
		const focused = untrack(() => focusedKey);
		const focusColor = resolveColor('--day-focus', '#ec4899');

		for (const day of days) {
			const isFocused = focused === day.key;
			const dim = focused !== null && !isFocused;
			const color = isFocused ? focusColor : resolveColor(day.colorVar, '#4a7c59');
			const z = isFocused ? 20 : 2;
			const layer: DayLayer = { key: day.key, colorVar: day.colorVar, markers: [], segments: [] };

			for (const segStops of day.segments) {
				for (const stop of segStops) {
					const pos = { lat: stop.lat, lng: stop.lng };
					const content = photoPin(stop, day.key, color);
					content.classList.toggle(DIM_CLASS, dim);
					const marker = new AdvancedMarker({
						map,
						position: pos,
						content,
						title: `${stop.n}. ${stop.title}`,
						zIndex: isFocused ? 1000 : null,
						gmpClickable: true
					});
					marker.addListener('click', () => {
						// A stop click focuses its day (never unfocuses) and shows its info.
						if (focusedKey !== day.key) onfocusday?.(day.key);
						openInfo(marker, `${stop.n}. ${stop.title}`, stop.icon, pos, stop.title);
					});
					layer.markers.push({ marker, content });
				}

				if (segStops.length < 2) continue;
				for (const run of chunkStops(segStops, MAX_STOPS_PER_REQUEST)) {
					const key = routeCacheKey(run);
					const seg: SegmentLayer = {
						stops: run,
						fallback: new google.maps.Polyline({
							map,
							path: run.map((p) => ({ lat: p.lat, lng: p.lng })),
							geodesic: true,
							clickable: true,
							strokeColor: color,
							strokeOpacity: 0,
							icons: dashIcons(dim ? DIM : 1),
							zIndex: z
						}),
						casing: null,
						stroke: null
					};
					layer.segments.push(seg);
					const cached = cache().get(key);
					if (cached) {
						drawSolid(seg, cached, color, dim, z);
					} else {
						pathFor(key, run)
							.then((path) => {
								// Days changed or the theme rebuilt the map meanwhile — the new
								// draw found this path in the cache already.
								if (gen !== generation || !map) return;
								const nowFocused = focusedKey;
								const f = nowFocused === day.key;
								drawSolid(
									seg,
									path,
									f
										? resolveColor('--day-focus', '#ec4899')
										: resolveColor(day.colorVar, '#4a7c59'),
									nowFocused !== null && !f,
									f ? 20 : 2
								);
								wireSegmentClicks(seg, day.key);
							})
							.catch((e: unknown) => {
								// Unroutable (ferry, flight, cross-border) or Routes API not enabled:
								// keep the dashed straight line; other segments/days are unaffected.
								if (!warned.has(key)) {
									warned.add(key);
									console.warn(
										`Route for day ${day.key} segment unavailable — drawing a straight line.`,
										e
									);
								}
							});
					}
					wireSegmentClicks(seg, day.key);
				}
			}
			dayLayers.push(layer);
		}
	}

	/** Route click toggles its day's focus (re-clicking the focused route exits). */
	function wireSegmentClicks(seg: SegmentLayer, key: string) {
		const toggle = () => onfocusday?.(focusedKey === key ? null : key);
		for (const line of [seg.fallback, seg.casing, seg.stroke]) {
			if (!line) continue;
			google.maps.event.clearListeners(line, 'click');
			line.addListener('click', toggle);
		}
	}

	/**
	 * Recolour + dim every layer for the focused day (`key`), or restore the
	 * all-days palette when null. `fit` moves the viewport too.
	 */
	function applyFocus(key: string | null, fit: boolean) {
		if (!map) return;
		const focusColor = resolveColor('--day-focus', '#ec4899');
		for (const layer of dayLayers) {
			const isFocused = key === layer.key;
			const dim = key !== null && !isFocused;
			const mult = dim ? DIM : 1;
			const color = isFocused ? focusColor : resolveColor(layer.colorVar, '#4a7c59');
			const z = isFocused ? 20 : 2;
			for (const m of layer.markers) {
				m.content.classList.toggle(DIM_CLASS, dim);
				m.content.style.setProperty('--day', color);
				m.marker.zIndex = isFocused ? 1000 : null;
			}
			for (const s of layer.segments) {
				s.fallback.setOptions({ strokeColor: color, icons: dashIcons(mult), zIndex: z });
				s.casing?.setOptions({ strokeOpacity: 0.55 * mult, zIndex: z });
				s.stroke?.setOptions({ strokeColor: color, strokeOpacity: 0.95 * mult, zIndex: z + 1 });
			}
		}
		// Category pins fade with the non-focused days.
		for (const s of spotMarkers) s.content.classList.toggle(DIM_CLASS, key !== null);
		if (key === null) info?.close();
		if (!fit) return;
		if (key) fitDay(key);
		else fitAll();
	}

	// The focus key the overlays currently reflect — skips redundant re-applies
	// (and the first run of the focus $effect right after init).
	let appliedFocus: string | null | undefined = undefined;

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
		// Clicking empty map exits a focus (and closes any open info window).
		map.addListener('click', () => {
			info?.close();
			if (focusedKey !== null) onfocusday?.(null);
		});
		// Tiles and strokes scale with zoom (the fit below fires zoom_changed too).
		applyZoomTier();
		map.addListener('zoom_changed', applyZoomTier);
		info = new InfoWindowCtor();
		drawSpots();
		drawDays();
		const key = untrack(() => focusedKey);
		// drawDays already painted the focus colours/dimming; only the category
		// pins' dim state and (on a fresh map) the viewport remain.
		applyFocus(key, !view);
		appliedFocus = key;
	}

	onMount(() => {
		if (!hasGoogleMapsKey) return; // keyless build — caller shows the solid hero instead
		let destroyed = false;

		(async () => {
			if (!loaderConfigured) {
				setOptions({ key: GOOGLE_MAPS_API_KEY, v: 'weekly' });
				loaderConfigured = true;
			}
			const [mapsLib, markerLib, routesLib] = await Promise.all([
				importLibrary('maps'),
				importLibrary('marker'),
				importLibrary('routes')
			]);
			if (destroyed || !mapEl) return;
			MapCtor = mapsLib.Map;
			InfoWindowCtor = mapsLib.InfoWindow;
			AdvancedMarker = markerLib.AdvancedMarkerElement;
			RouteCtor = routesLib.Route;
			createMap();
			ready = true;
		})().catch((e) => {
			// Invalid/exhausted key or blocked network — stay on the cream backdrop
			// instead of surfacing an unhandled rejection.
			console.warn('Google Maps failed to load — map backdrop disabled.', e);
		});

		return () => {
			destroyed = true;
			generation += 1; // drop any in-flight route results
			clearDays();
			zoomClampListener?.remove();
			zoomClampListener = null;
			for (const m of spotMarkers) m.marker.map = null;
			spotMarkers = [];
			info = null;
			map = null;
			ready = false;
		};
	});

	// Rebuild category pins if the trip's spots change (e.g. a co-pilot edit),
	// without yanking the viewport — only refit when we go from empty to populated.
	// Reading `layers` here registers it as a dependency; the identity check
	// skips the first run after init (createMap already drew this set).
	$effect(() => {
		const next = layers;
		if (!ready || next === lastDrawnLayers) return;
		const hadNone = spotMarkers.length === 0 && dayLayers.length === 0;
		drawSpots();
		applyFocus(
			untrack(() => focusedKey),
			false
		);
		if (hadNone && allBounds) fitAll();
	});

	// Redraw the day layers when the itinerary changes; only the segments whose
	// coordinates changed miss the route cache, so the rest re-draw instantly.
	$effect(() => {
		const next = days;
		if (!ready || next === lastDrawnDays) return;
		const hadNone = dayLayers.length === 0 && spotMarkers.length === 0;
		drawDays();
		applyFocus(
			untrack(() => focusedKey),
			false
		);
		if (hadNone && allBounds) fitAll();
	});

	// Focus changes (card open/close, legend, map clicks) recolour + refit.
	$effect(() => {
		const key = focusedKey;
		if (!ready || key === appliedFocus) return;
		appliedFocus = key;
		applyFocus(key, true);
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
	style="height: {height}px; --tile: {tier.tile}px; --tile-font: {tier.tileFont}px; --badge: {tier.badge}px; --badge-font: {tier.badgeFont}px"
	bind:this={mapEl}
	role="region"
	aria-label="Map of the trip's spots"
></div>
<!-- Colour probe: design tokens are painted onto it and read back as rgb() for
     the Maps API (see resolveColor). Never visible. -->
<span bind:this={probeEl} hidden aria-hidden="true"></span>

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
