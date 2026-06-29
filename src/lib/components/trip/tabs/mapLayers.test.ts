import { describe, expect, test } from 'bun:test';
import { buildAllSpots, dayFocus, boundsOf } from './mapLayers';
import { RestaurantSchema, ViralSpotSchema, CoordsSchema } from '$lib/schemas/schemas';
import type { Day, Trip } from '$lib/trips';

// Minimal trip fixture — buildAllSpots only reads itinerary/restaurants/viral, so
// the rest is filled in just enough to satisfy the type.
function makeTrip(parts: Partial<Pick<Trip, 'itinerary' | 'restaurants' | 'viral'>>): Trip {
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

		// 4 coord-bearing across the trip (activity + leg + restaurant + viral);
		// 3 coord-less items skipped.
		expect(spots).toHaveLength(4);

		const byCategory = (c: string) => spots.filter((s) => s.category === c);
		expect(byCategory('activity')).toHaveLength(2); // activity + leg both coord-bearing
		expect(byCategory('restaurant')).toHaveLength(1);
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
