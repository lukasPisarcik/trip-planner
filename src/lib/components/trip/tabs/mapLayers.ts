// Pure, framework-free helpers that derive what the map backdrop plots from a
// Trip. Kept out of the Svelte component so the derivation is unit-testable
// under Bun (see mapLayers.test.ts). No map-provider import here — these return
// plain data that TripMap.svelte turns into markers/polylines/bounds.

import type { Day, Trip } from '$lib/trips';

/** Which part of the trip a plotted spot came from — drives the pin colour. */
export type SpotCategory = 'activity' | 'restaurant' | 'viral' | 'stay';

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

/** SW + NE corners, as [[lat, lng], [lat, lng]] tuples. */
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

	for (const city of trip.accommodation?.cities ?? []) {
		for (const place of city.places) {
			if (place.coords) {
				spots.push({
					lat: place.coords.lat,
					lng: place.coords.lng,
					title: place.name,
					category: 'stay'
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

/** A numbered stop within a day's route, plus its optional photo tile. */
export interface DayStop extends DaySegmentPoint {
	/** Wikimedia image URL (full size — TripMap downsizes it via wikiThumb). */
	imageUrl?: string;
}

/** One itinerary day's persistent route layer on the backdrop. */
export interface DayRoute {
	/** `${number}-${date}` — the same key DayCard / TripView use for focus. */
	key: string;
	number: string | number;
	title: string;
	/** '--day-1' … '--day-8' — resolved to a colour by TripMap at draw time. */
	colorVar: string;
	/** Split at coord-less legs, exactly like dayFocus. */
	segments: DayStop[][];
	bounds: BoundsTuple | null;
}

/** Number of `--day-N` tokens in app.css; colours cycle past it. */
export const DAY_PALETTE_SIZE = 8;

/** The focus key shared by the day cards, the legend and the map layers. */
export const dayKey = (d: Pick<Day, 'number' | 'date'>): string => `${d.number}-${d.date}`;

/** Palette token for the i-th drawn day (0-based), cycling after 8. */
export const dayColorVar = (i: number): string => `--day-${(i % DAY_PALETTE_SIZE) + 1}`;

/**
 * Number the coord-bearing stops in itinerary order and split them into
 * stretches — a coord-less transport leg ends one stretch so the route never
 * draws a line across a bus/train ride.
 */
function daySegments(day: Day): DayStop[][] {
	const segments: DayStop[][] = [];
	let current: DayStop[] = [];
	let n = 0;

	for (const item of day.items) {
		if (item.coords) {
			n += 1;
			const stop: DayStop = {
				lat: item.coords.lat,
				lng: item.coords.lng,
				n,
				title: item.title,
				icon: item.icon
			};
			if (item.kind === 'activity' && item.image) stop.imageUrl = item.image.url;
			current.push(stop);
		} else if (item.kind === 'leg' && current.length) {
			segments.push(current);
			current = [];
		}
	}
	if (current.length) segments.push(current);
	return segments;
}

/**
 * One day's numbered stretches + bounds. The reference derivation that
 * DayCard's badge numbering mirrors (plan §6) — not called by the map itself,
 * which draws every day from buildDayRoutes.
 */
export function dayFocus(day: Day): DayFocus {
	const segments = daySegments(day);
	return { segments, bounds: boundsOf(segments.flat()) };
}

/**
 * Every day with at least one coord-bearing stop, in itinerary order, as a
 * persistent route layer. The palette index counts only the drawn days, so
 * two consecutive drawn days never share a colour because of a coord-less
 * day between them.
 */
export function buildDayRoutes(trip: Trip): DayRoute[] {
	const out: DayRoute[] = [];
	for (const day of trip.itinerary?.days ?? []) {
		const segments = daySegments(day);
		if (segments.length === 0) continue;
		out.push({
			key: dayKey(day),
			number: day.number,
			title: day.title,
			colorVar: dayColorVar(out.length),
			segments,
			bounds: boundsOf(segments.flat())
		});
	}
	return out;
}

/**
 * Split a segment into overlapping runs of at most `max` stops (origin + up to
 * 10 intermediates + destination for the Routes Essentials SKU). Consecutive
 * runs share their boundary stop so the drawn paths join: [0..11], [11..22], …
 */
export function chunkStops<T>(seg: T[], max = 12): T[][] {
	if (seg.length <= max) return [seg];
	const out: T[][] = [];
	for (let start = 0; start < seg.length - 1; start += max - 1) {
		out.push(seg.slice(start, start + max));
	}
	return out;
}

/**
 * Stable cache key for a segment's coordinates: 5-decimal rounding (~1 m) so
 * float noise never misses the cache, djb2-hashed to base36 and prefixed with a
 * version so a stored-shape change can invalidate old entries.
 */
export function routeCacheKey(points: { lat: number; lng: number }[]): string {
	const round5 = (v: number) => Math.round(v * 1e5) / 1e5;
	const s = points.map((p) => `${round5(p.lat)},${round5(p.lng)}`).join(';');
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
	return `v1:${points.length}:${h.toString(36)}`;
}
