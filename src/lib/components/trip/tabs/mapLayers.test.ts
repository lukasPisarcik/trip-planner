import { describe, expect, test } from 'bun:test';
import {
	buildAllSpots,
	buildDayRoutes,
	chunkStops,
	dayColorVar,
	dayFocus,
	dayKey,
	boundsOf,
	routeCacheKey,
	DAY_PALETTE_SIZE
} from './mapLayers';
import { RestaurantSchema, ViralSpotSchema, CoordsSchema } from '$lib/schemas/schemas';
import type { Day, Trip } from '$lib/trips';

// Minimal trip fixture — buildAllSpots only reads itinerary/restaurants/
// accommodation/viral, so the rest is filled in just enough to satisfy the type.
function makeTrip(
	parts: Partial<Pick<Trip, 'itinerary' | 'restaurants' | 'accommodation' | 'viral'>>
): Trip {
	return {
		itinerary: { callout: '', days: [] },
		viral: { callout: '', sections: [], note: '' },
		...parts
	} as unknown as Trip;
}

describe('buildAllSpots', () => {
	test('only coord-bearing items become spots; categories are tagged', () => {
		const trip = makeTrip({
			itinerary: {
				callout: '',
				days: [
					{
						number: 1,
						date: 'Jul 8',
						flag: '🇩🇪',
						title: 'Day 1',
						subtitle: '',
						items: [
							{
								kind: 'activity',
								icon: '🏛',
								title: 'Museum',
								description: '',
								coords: { lat: 52.52, lng: 13.4 }
							},
							// No coords → skipped.
							{ kind: 'activity', icon: '🎨', title: 'No-coord stop', description: '' },
							{
								kind: 'leg',
								icon: '🚌',
								title: 'Bus',
								description: '',
								coords: { lat: 52.5, lng: 13.41 }
							}
						]
					}
				]
			},
			restaurants: {
				callout: '',
				note: '',
				cities: [
					{
						city: 'Berlin',
						places: [
							{
								category: 'food',
								name: 'Curry 36',
								location: '',
								description: '',
								rating: 4.5,
								ratingCount: 100,
								tags: [],
								coords: { lat: 52.49, lng: 13.39 }
							},
							// No coords → skipped.
							{
								category: 'coffee',
								name: 'No-coord café',
								location: '',
								description: '',
								rating: 4,
								ratingCount: 10,
								tags: []
							}
						]
					}
				]
			},
			accommodation: {
				callout: '',
				note: '',
				cities: [
					{
						city: 'Berlin',
						places: [
							{
								type: 'hostel',
								name: 'Circus Hostel',
								location: '',
								description: '',
								pricePerNight: '€30 dorm',
								rating: 9.1,
								ratingCount: 5000,
								tags: [],
								coords: { lat: 52.53, lng: 13.4 }
							},
							// No coords → skipped.
							{
								type: 'hotel',
								name: 'No-coord hotel',
								location: '',
								description: '',
								pricePerNight: '€90',
								rating: 8.2,
								ratingCount: 900,
								tags: []
							}
						]
					}
				]
			},
			viral: {
				callout: '',
				note: '',
				sections: [
					{
						label: 'Hot',
						spots: [
							{
								color: 'fire',
								heat: 'fire',
								icon: '🔥',
								title: 'Rooftop',
								location: '',
								description: '',
								tags: [],
								coords: { lat: 52.51, lng: 13.38 }
							},
							// No coords → skipped.
							{
								color: 'sky',
								heat: 'hot',
								icon: '📸',
								title: 'No-coord spot',
								location: '',
								description: '',
								tags: []
							}
						]
					}
				]
			}
		});

		const { spots } = buildAllSpots(trip);

		// 5 coord-bearing across the trip (activity + leg + restaurant + stay + viral);
		// 4 coord-less items skipped.
		expect(spots).toHaveLength(5);

		const byCategory = (c: string) => spots.filter((s) => s.category === c);
		expect(byCategory('activity')).toHaveLength(2); // activity + leg both coord-bearing
		expect(byCategory('restaurant')).toHaveLength(1);
		expect(byCategory('stay')).toHaveLength(1);
		expect(byCategory('viral')).toHaveLength(1);

		// No coord-less item leaked in.
		expect(spots.every((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))).toBe(true);
		expect(spots.map((s) => s.title)).not.toContain('No-coord stop');
	});

	test('a coord-less trip yields no spots', () => {
		const trip = makeTrip({
			itinerary: {
				callout: '',
				days: [
					{
						number: 1,
						date: 'Jul 8',
						flag: '🇩🇪',
						title: 'Day 1',
						subtitle: '',
						items: [{ kind: 'activity', icon: '🎨', title: 'Stop', description: '' }]
					}
				]
			}
		});
		expect(buildAllSpots(trip).spots).toEqual([]);
	});

	test('an empty trip yields no spots', () => {
		expect(buildAllSpots(makeTrip({})).spots).toEqual([]);
	});
});

describe('dayFocus', () => {
	const day = (items: Day['items']): Day => ({
		number: 1,
		date: 'Jul 8',
		flag: '🇩🇪',
		title: 'Day 1',
		subtitle: '',
		items
	});

	test('numbers coord stops and returns their bounding box', () => {
		const focus = dayFocus(
			day([
				{
					kind: 'activity',
					icon: '🏛',
					title: 'A',
					description: '',
					coords: { lat: 52.5, lng: 13.3 }
				},
				{
					kind: 'activity',
					icon: '☕',
					title: 'B',
					description: '',
					coords: { lat: 52.6, lng: 13.5 }
				}
			])
		);
		expect(focus.segments).toHaveLength(1);
		expect(focus.segments[0].map((p) => p.n)).toEqual([1, 2]);
		expect(focus.bounds).toEqual([
			[52.5, 13.3],
			[52.6, 13.5]
		]);
	});

	test('a coord-less leg splits the route into separate walking stretches', () => {
		const focus = dayFocus(
			day([
				{
					kind: 'activity',
					icon: '🏛',
					title: 'A',
					description: '',
					coords: { lat: 52.5, lng: 13.3 }
				},
				// Coord-less leg ends the first stretch.
				{ kind: 'leg', icon: '🚌', title: 'Bus', description: '' },
				{
					kind: 'activity',
					icon: '☕',
					title: 'B',
					description: '',
					coords: { lat: 52.6, lng: 13.5 }
				}
			])
		);
		expect(focus.segments).toHaveLength(2);
		// Numbering is continuous across the split.
		expect(focus.segments[0][0].n).toBe(1);
		expect(focus.segments[1][0].n).toBe(2);
	});

	test('a day with no coords has null bounds and no segments', () => {
		const focus = dayFocus(day([{ kind: 'activity', icon: '🎨', title: 'A', description: '' }]));
		expect(focus.segments).toEqual([]);
		expect(focus.bounds).toBeNull();
	});
});

describe('boundsOf', () => {
	test('returns null for an empty set', () => {
		expect(boundsOf([])).toBeNull();
	});
});

describe('buildDayRoutes', () => {
	const stop = (
		title: string,
		lat: number,
		lng: number,
		imageUrl?: string
	): Day['items'][number] => ({
		kind: 'activity',
		icon: '📍',
		title,
		description: '',
		coords: { lat, lng },
		...(imageUrl ? { image: { url: imageUrl, alt: title } } : {})
	});
	const day = (number: number, items: Day['items']): Day => ({
		number,
		date: `Jul ${number}`,
		flag: '🇩🇪',
		title: `Day ${number}`,
		subtitle: '',
		items
	});

	test('skips coord-less days and numbers colours over the drawn days only', () => {
		const trip = makeTrip({
			itinerary: {
				callout: '',
				days: [
					day(1, [stop('A', 52.5, 13.3)]),
					// No coords at all → not drawn, and it must not consume a colour.
					day(2, [{ kind: 'activity', icon: '🎨', title: 'Museum', description: '' }]),
					day(3, [stop('B', 52.6, 13.4), stop('C', 52.7, 13.5)])
				]
			}
		});
		const routes = buildDayRoutes(trip);
		expect(routes.map((r) => r.key)).toEqual(['1-Jul 1', '3-Jul 3']);
		expect(routes.map((r) => r.colorVar)).toEqual(['--day-1', '--day-2']);
		expect(routes[1].number).toBe(3);
		expect(routes[1].title).toBe('Day 3');
		expect(routes[1].bounds).toEqual([
			[52.6, 13.4],
			[52.7, 13.5]
		]);
	});

	test('the palette cycles after 8 drawn days', () => {
		const days = Array.from({ length: 10 }, (_, i) => day(i + 1, [stop('S', 50 + i, 10)]));
		const routes = buildDayRoutes(makeTrip({ itinerary: { callout: '', days } }));
		expect(routes).toHaveLength(10);
		expect(routes[7].colorVar).toBe('--day-8');
		expect(routes[8].colorVar).toBe('--day-1');
		expect(routes[9].colorVar).toBe('--day-2');
	});

	test('segments split at coord-less legs and carry the stop image', () => {
		const trip = makeTrip({
			itinerary: {
				callout: '',
				days: [
					day(1, [
						stop('A', 52.5, 13.3, 'https://upload.wikimedia.org/a.jpg'),
						{ kind: 'leg', icon: '🚌', title: 'Bus', description: '' },
						stop('B', 52.6, 13.4)
					])
				]
			}
		});
		const [route] = buildDayRoutes(trip);
		expect(route.segments).toHaveLength(2);
		expect(route.segments[0][0]).toMatchObject({
			n: 1,
			title: 'A',
			imageUrl: 'https://upload.wikimedia.org/a.jpg'
		});
		expect(route.segments[1][0]).toMatchObject({ n: 2, title: 'B' });
		expect(route.segments[1][0].imageUrl).toBeUndefined();
	});

	test('an empty trip draws nothing', () => {
		expect(buildDayRoutes(makeTrip({}))).toEqual([]);
	});

	test('dayKey / dayColorVar match the card key and the token names', () => {
		expect(dayKey({ number: 3, date: 'Jul 10' })).toBe('3-Jul 10');
		expect(dayColorVar(0)).toBe('--day-1');
		expect(dayColorVar(DAY_PALETTE_SIZE - 1)).toBe(`--day-${DAY_PALETTE_SIZE}`);
		expect(dayColorVar(DAY_PALETTE_SIZE)).toBe('--day-1');
	});
});

describe('chunkStops', () => {
	const seq = (n: number) => Array.from({ length: n }, (_, i) => i);

	test('a segment within the limit is a single chunk', () => {
		expect(chunkStops(seq(12))).toEqual([seq(12)]);
		expect(chunkStops(seq(2))).toEqual([seq(2)]);
	});

	test('longer segments overlap by one stop and never exceed 12', () => {
		const chunks = chunkStops(seq(23));
		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toEqual(seq(12)); // 0..11
		expect(chunks[1]).toEqual(seq(23).slice(11)); // 11..22
		for (const c of chunks) expect(c.length).toBeLessThanOrEqual(12);
	});

	test('the trailing chunk always has at least two stops', () => {
		const chunks = chunkStops(seq(13));
		expect(chunks).toHaveLength(2);
		expect(chunks[1]).toEqual([11, 12]);
		const chunks2 = chunkStops(seq(30));
		expect(chunks2.map((c) => c.length)).toEqual([12, 12, 8]);
		expect(chunks2[2][0]).toBe(22);
	});
});

describe('routeCacheKey', () => {
	const pts = [
		{ lat: 52.520008, lng: 13.404954 },
		{ lat: 48.856614, lng: 2.352222 }
	];

	test('is stable across float noise below 1e-5 and prefixed with the version', () => {
		const noisy = pts.map((p) => ({ lat: p.lat + 1e-7, lng: p.lng - 2e-7 }));
		expect(routeCacheKey(pts)).toBe(routeCacheKey(noisy));
		expect(routeCacheKey(pts).startsWith('v1:2:')).toBe(true);
	});

	test('differs when a stop moves, is added, or the order flips', () => {
		const base = routeCacheKey(pts);
		expect(routeCacheKey([pts[0], { lat: 48.86, lng: 2.35 }])).not.toBe(base);
		expect(routeCacheKey([...pts, { lat: 50, lng: 10 }])).not.toBe(base);
		expect(routeCacheKey([pts[1], pts[0]])).not.toBe(base);
	});
});

// The map feature hangs on optional `coords` being backward-compatible — assert
// it directly so a regression in the schema is caught here too (plan §7).
describe('coords schema', () => {
	const baseRestaurant = {
		category: 'food',
		name: 'X',
		location: '',
		description: '',
		rating: 4,
		ratingCount: 1,
		tags: []
	};
	const baseViral = {
		color: 'fire',
		heat: 'fire',
		icon: '🔥',
		title: 'X',
		location: '',
		description: '',
		tags: []
	};

	test('restaurants parse with and without coords', () => {
		expect(RestaurantSchema.safeParse(baseRestaurant).success).toBe(true);
		expect(
			RestaurantSchema.safeParse({ ...baseRestaurant, coords: { lat: 52.5, lng: 13.4 } }).success
		).toBe(true);
	});

	test('viral spots parse with and without coords', () => {
		expect(ViralSpotSchema.safeParse(baseViral).success).toBe(true);
		expect(
			ViralSpotSchema.safeParse({ ...baseViral, coords: { lat: 52.5, lng: 13.4 } }).success
		).toBe(true);
	});

	test('out-of-range coordinates are rejected', () => {
		expect(CoordsSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
		expect(CoordsSchema.safeParse({ lat: 0, lng: 181 }).success).toBe(false);
	});
});
