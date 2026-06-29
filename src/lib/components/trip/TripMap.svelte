<script lang="ts">
	import { onMount } from 'svelte';
	import type { Map as LeafletMap, TileLayer, LayerGroup } from 'leaflet';
	import { themeStore } from '$lib/stores';
	import type { MapLayers, SpotCategory, DayFocus } from './tabs/mapLayers';
	import { boundsOf } from './tabs/mapLayers';
	import 'leaflet/dist/leaflet.css';

	let {
		layers,
		height,
		interactive = false,
		class: className = ''
	}: {
		/** The constant marker set (all coord-bearing spots). */
		layers: MapLayers;
		/** Container height in px; every change re-tiles the map via invalidateSize. */
		height: number;
		/** Pan/zoom enabled (expanded or fullscreen) vs. a static backdrop (collapsed). */
		interactive?: boolean;
		class?: string;
	} = $props();

	// CartoDB basemaps — free, no API key, so they work on the static viewer build.
	const TILES = {
		light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
		dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
	};

	// Per-category pin colour, resolved from the theme-aware tokens at draw time.
	const CATEGORY_VAR: Record<SpotCategory, string> = {
		activity: '--sage',
		restaurant: '--amber',
		viral: '--fire'
	};

	let mapEl: HTMLDivElement;
	let L: typeof import('leaflet') | null = null;
	let map: LeafletMap | null = null;
	let tiles: TileLayer | null = null;
	let spotsLayer: LayerGroup | null = null;
	let routeLayer: LayerGroup | null = null;
	let ready = $state(false);

	function escapeHtml(s: string): string {
		return s.replace(
			/[&<>"]/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string
		);
	}

	function cssVar(name: string, fallback: string): string {
		if (!mapEl) return fallback;
		return getComputedStyle(mapEl).getPropertyValue(name).trim() || fallback;
	}

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			!!window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	const allBounds = $derived(boundsOf(layers.spots));

	/** Bounds of every spot, fit (animated unless reduced motion). */
	function fitAll(animate = true) {
		if (!map || !L || !allBounds) return;
		map.fitBounds(L.latLngBounds(allBounds), {
			padding: [48, 48],
			maxZoom: 14,
			animate: animate && !prefersReducedMotion()
		});
	}

	/** Plot the constant all-spots marker set. */
	function drawSpots() {
		if (!map || !L || !spotsLayer) return;
		spotsLayer.clearLayers();
		for (const spot of layers.spots) {
			const color = cssVar(CATEGORY_VAR[spot.category], '#4a7c59');
			L.marker([spot.lat, spot.lng], {
				title: spot.title,
				keyboard: false,
				icon: L.divIcon({
					className: 'trip-map-pin-wrap',
					html: `<span class="trip-map-pin trip-map-pin-${spot.category}" style="--pin:${color}">${spot.icon ?? ''}</span>`,
					iconSize: [18, 18],
					iconAnchor: [9, 9],
					popupAnchor: [0, -10]
				})
			})
				.addTo(spotsLayer)
				.bindPopup(`${spot.icon ? spot.icon + ' ' : ''}${escapeHtml(spot.title)}`);
		}
	}

	/** Enable/disable pan + zoom handlers to match the collapsed/expanded state. */
	function applyInteractivity() {
		if (!map) return;
		const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom, map.keyboard];
		for (const h of handlers) {
			if (interactive) h?.enable();
			else h?.disable();
		}
		// `tap` only exists on touch builds.
		const tap = (map as unknown as { tap?: { enable(): void; disable(): void } }).tap;
		if (interactive) tap?.enable();
		else tap?.disable();
	}

	/**
	 * Fly the backdrop to a single day's stops and draw its highlighted route.
	 * The marker set is unchanged — only the viewport + the transient route layer.
	 */
	export function focus(f: DayFocus) {
		if (!map || !L || !routeLayer) return;
		routeLayer.clearLayers();
		const accent = cssVar('--trip-accent', '#4a7c59');
		for (const seg of f.segments) {
			if (seg.length >= 2) {
				L.polyline(
					seg.map((p) => [p.lat, p.lng] as [number, number]),
					{ color: accent, weight: 4, opacity: 0.9, dashArray: '1 9', lineCap: 'round' }
				).addTo(routeLayer);
			}
			for (const p of seg) {
				L.marker([p.lat, p.lng], {
					keyboard: false,
					zIndexOffset: 1000,
					icon: L.divIcon({
						className: 'trip-map-route-pin-wrap',
						html: `<span class="trip-map-route-pin">${p.n}</span>`,
						iconSize: [28, 28],
						iconAnchor: [14, 14],
						popupAnchor: [0, -14]
					})
				})
					.addTo(routeLayer)
					.bindPopup(`<b>${p.n}.</b> ${p.icon ? p.icon + ' ' : ''}${escapeHtml(p.title)}`);
			}
		}
		if (f.bounds) {
			const b = L.latLngBounds(f.bounds);
			const opts = { padding: [56, 56] as [number, number], maxZoom: 16 };
			if (prefersReducedMotion()) map.fitBounds(b, { ...opts, animate: false });
			else map.flyToBounds(b, { ...opts, duration: 0.8 });
		}
	}

	/** Clear any day highlight and return to the all-spots view. */
	export function reset() {
		routeLayer?.clearLayers();
		fitAll();
	}

	onMount(() => {
		let destroyed = false;

		(async () => {
			L = await import('leaflet');
			if (destroyed || !mapEl) return;

			map = L.map(mapEl, {
				scrollWheelZoom: false,
				zoomControl: true,
				attributionControl: true
			});
			tiles = L.tileLayer(themeStore.current === 'dark' ? TILES.dark : TILES.light, {
				subdomains: 'abcd',
				maxZoom: 20,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
			}).addTo(map);

			spotsLayer = L.layerGroup().addTo(map);
			routeLayer = L.layerGroup().addTo(map);

			drawSpots();
			if (allBounds) fitAll(false);
			else map.setView([20, 0], 2); // no spots — a neutral world view (caller hides it anyway)

			applyInteractivity();
			ready = true;
			requestAnimationFrame(() => map?.invalidateSize());
		})();

		return () => {
			destroyed = true;
			map?.remove();
			map = null;
			tiles = null;
			spotsLayer = null;
			routeLayer = null;
			ready = false;
		};
	});

	// Re-tile whenever the container height changes (scroll-collapse / expand).
	// Reading `height` here registers it as a dependency.
	$effect(() => {
		const px = height;
		if (ready && px > 0) requestAnimationFrame(() => map?.invalidateSize());
	});

	// Rebuild markers if the trip's spots change (e.g. a co-pilot edit), without
	// yanking the viewport — only refit when we go from empty to populated.
	// drawSpots() reads `layers`, so the effect tracks it.
	$effect(() => {
		if (!ready) return;
		const hadNone = (spotsLayer?.getLayers().length ?? 0) === 0;
		drawSpots();
		if (hadNone && allBounds) fitAll(false);
	});

	// Follow the app's light/dark toggle.
	$effect(() => {
		const theme = themeStore.current;
		tiles?.setUrl(theme === 'dark' ? TILES.dark : TILES.light);
	});

	// Static backdrop when collapsed; interactive when expanded/fullscreen.
	// applyInteractivity() reads `interactive`, so the effect tracks it.
	$effect(() => {
		if (ready) applyInteractivity();
	});
</script>

<div
	class="trip-map {className}"
	class:interactive
	style="height: {height}px"
	bind:this={mapEl}
	role="region"
	aria-label="Map of the trip's spots"
></div>

<style>
	.trip-map {
		width: 100%;
		background: var(--cream);
		/* Contain Leaflet's high-z-index panes in their own stacking context, so
		   they don't paint over the glass hero / controls layered above the map. */
		position: relative;
		isolation: isolate;
		/* Collapsed backdrop is non-interactive so page scroll passes through. */
		pointer-events: none;
	}
	.trip-map.interactive {
		pointer-events: auto;
	}
	.trip-map :global(.leaflet-container) {
		height: 100%;
		width: 100%;
		font-family: inherit;
		background: var(--cream);
	}
	/* Leaflet injects markers/popups at runtime, so these must be global. */
	:global(.trip-map-pin) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		font-size: 10px;
		line-height: 1;
		background: var(--pin, #4a7c59);
		border: 2px solid #fff;
		border-radius: 50%;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}
	:global(.trip-map-route-pin) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
		color: #fff;
		background: var(--trip-accent, #4a7c59);
		border: 2px solid #fff;
		border-radius: 50%;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
	}
	.trip-map :global(.leaflet-popup-content) {
		font-size: 12.5px;
		line-height: 1.45;
		margin: 8px 12px;
	}
</style>
