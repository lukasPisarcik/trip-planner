<script module lang="ts">
	/** A single numbered stop plotted on the day map. */
	export interface DayMapPoint {
		lat: number;
		lng: number;
		/** 1-based number shown on the marker, matching the itinerary list. */
		n: number;
		title: string;
		icon?: string;
	}
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Map as LeafletMap, TileLayer } from 'leaflet';
	import { themeStore } from '$lib/stores';
	import 'leaflet/dist/leaflet.css';

	// Each inner array is one uninterrupted walking stretch; the connecting line
	// breaks between segments (e.g. where a bus/train leg splits the day).
	let { segments }: { segments: DayMapPoint[][] } = $props();

	const points = $derived(segments.flat());

	let mapEl: HTMLDivElement;
	let map: LeafletMap | null = null;
	let tiles: TileLayer | null = null;

	// CartoDB basemaps — free, no API key, so they work on the static viewer build.
	const TILES = {
		light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
		dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
	};

	function escapeHtml(s: string): string {
		return s.replace(
			/[&<>"]/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string
		);
	}

	onMount(() => {
		let destroyed = false;
		let cleanup = () => {};

		(async () => {
			const L = await import('leaflet');
			if (destroyed || !mapEl || points.length === 0) return;

			const accent = getComputedStyle(mapEl).getPropertyValue('--trip-accent').trim() || '#4a7c59';

			map = L.map(mapEl, { scrollWheelZoom: false });

			tiles = L.tileLayer(themeStore.current === 'dark' ? TILES.dark : TILES.light, {
				subdomains: 'abcd',
				maxZoom: 20,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
			}).addTo(map);

			// One connecting line per walking stretch — never drawn across a transport leg.
			for (const seg of segments) {
				if (seg.length < 2) continue;
				L.polyline(
					seg.map((p) => [p.lat, p.lng] as [number, number]),
					{ color: accent, weight: 3, opacity: 0.8, dashArray: '1 9', lineCap: 'round' }
				).addTo(map);
			}

			for (const p of points) {
				L.marker([p.lat, p.lng], {
					title: p.title,
					keyboard: false,
					icon: L.divIcon({
						className: 'day-map-pin-wrap',
						html: `<div class="day-map-pin">${p.n}</div>`,
						iconSize: [30, 30],
						iconAnchor: [15, 15],
						popupAnchor: [0, -15]
					})
				})
					.addTo(map)
					.bindPopup(`<b>${p.n}.</b> ${p.icon ? p.icon + ' ' : ''}${escapeHtml(p.title)}`);
			}

			map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
				padding: [34, 34],
				maxZoom: 16
			});

			// The card body has just become visible; make sure tiles size correctly.
			await tick();
			map.invalidateSize();

			cleanup = () => map?.remove();
		})();

		return () => {
			destroyed = true;
			cleanup();
			map = null;
			tiles = null;
		};
	});

	// Follow the app's light/dark toggle.
	$effect(() => {
		const theme = themeStore.current;
		tiles?.setUrl(theme === 'dark' ? TILES.dark : TILES.light);
	});
</script>

<div class="day-map" bind:this={mapEl} role="region" aria-label="Map of the day's route"></div>

<style>
	.day-map {
		height: 260px;
		margin-bottom: 12px;
		border-radius: 10px;
		border: 1px solid var(--trip-border);
		overflow: hidden;
		background: var(--cream);
		z-index: 0;
	}
	.day-map :global(.leaflet-container) {
		height: 100%;
		width: 100%;
		border-radius: 10px;
		font-family: inherit;
		background: var(--cream);
	}
	/* Leaflet injects markers at runtime, so these must be global. */
	:global(.day-map-pin) {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--trip-accent, #4a7c59);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
		border: 2px solid #fff;
		border-radius: 50%;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
	}
	.day-map :global(.leaflet-popup-content) {
		font-size: 12.5px;
		line-height: 1.45;
		margin: 8px 12px;
	}
	@media (max-width: 640px) {
		.day-map {
			height: 220px;
		}
	}
</style>
