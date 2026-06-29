// Pure, framework-free helpers that derive what the map backdrop plots from a
// Trip. Kept out of the Svelte component so the derivation is unit-testable
// under Bun (see mapLayers.test.ts). No Leaflet import here — these return plain
// data that TripMap.svelte turns into markers/polylines/bounds.

import type { Day, Trip } from '$lib/trips';

/** Which part of the trip a plotted spot came from — drives the pin colour. */
export type SpotCategory = 'activity' | 'restaurant' | 'viral';

/** One coord-bearing place plotted on the persistent backdrop. */
export interface MapSpot {
	lat: number;
	lng: number;
	title: string;
	category: SpotCategory;
	icon?: string;
}

/** The constant marker set the backdrop shows on every tab. */
export interface MapLayers {
	spots: MapSpot[];
}

/** A numbered stop within a single day's walking route. */
export interface DaySegmentPoint {
	lat: number;
	lng: number;
	/** 1-based number matching the itinerary list. */
	n: number;
	title: string;
	icon?: string;
}

/** SW + NE corners — the tuple shape Leaflet's `fitBounds` accepts. */
export type BoundsTuple = [[number, number], [number, number]];

/** Where to fly the backdrop (and what route to draw) when a day is opened. */
export interface DayFocus {
	/**
	 * Each inner array is one uninterrupted walking stretch; the connecting line
	 * breaks between segments (e.g. where a bus/train leg without coords splits
	 * the day) — mirrors the old DayMap behaviour.
	 */
	segments: DaySegmentPoint[][];
	/** Null when the day has no coord-bearing stops. */
	bounds: BoundsTuple | null;
}

/** Bounding box of a set of points, or null when empty. */
export function boundsOf(points: { lat: number; lng: number }[]): BoundsTuple | null {
	if (points.length === 0) return null;
	let minLat = Infinity;
	let minLng = Infinity;
	let maxLat = -Infinity;
	let maxLng = -Infinity;
	for (const p of points) {
		if (p.lat < minLat) minLat = p.lat;
		if (p.lat > maxLat) maxLat = p.lat;
		if (p.lng < minLng) minLng = p.lng;
		if (p.lng > maxLng) maxLng = p.lng;
	}
	return [
		[minLat, minLng],
		[maxLat, maxLng]
	];
}

/**
 * Every coord-bearing spot across the trip — itinerary activities/legs,
 * restaurants and viral spots — as one flat marker set. Coord-less items are
 * skipped, so a trip with no coordinates yields an empty list (the caller hides
 * the backdrop in that case).
 */
export function buildAllSpots(trip: Trip): MapLayers {
	const spots: MapSpot[] = [];

	for (const day of trip.itinerary?.days ?? []) {
		for (const item of day.items) {
			if (item.coords) {
				spots.push({
					lat: item.coords.lat,
					lng: item.coords.lng,
					title: item.title,
					category: 'activity',
					icon: item.icon
				});
			}
		}
	}

	for (const city of trip.restaurants?.cities ?? []) {
		for (const place of city.places) {
			if (place.coords) {
				spots.push({
					lat: place.coords.lat,
					lng: place.coords.lng,
					title: place.name,
					category: 'restaurant'
				});
			}
		}
	}

	for (const section of trip.viral?.sections ?? []) {
		for (const spot of section.spots) {
			if (spot.coords) {
				spots.push({
					lat: spot.coords.lat,
					lng: spot.coords.lng,
					title: spot.title,
					category: 'viral',
					icon: spot.icon
				});
			}
		}
	}

	return { spots };
}

/**
 * The route + bounds to fly to when a day is opened. Numbers the coord-bearing
 * stops in itinerary order and splits them into walking stretches — a coord-less
 * transport leg ends one stretch so the route never draws a line across a
 * bus/train ride.
 */
export function dayFocus(day: Day): DayFocus {
	const segments: DaySegmentPoint[][] = [];
	let current: DaySegmentPoint[] = [];
	let n = 0;

	for (const item of day.items) {
		if (item.coords) {
			n += 1;
			current.push({
				lat: item.coords.lat,
				lng: item.coords.lng,
				n,
				title: item.title,
				icon: item.icon
			});
		} else if (item.kind === 'leg' && current.length) {
			segments.push(current);
			current = [];
		}
	}
	if (current.length) segments.push(current);

	return { segments, bounds: boundsOf(segments.flat()) };
}
