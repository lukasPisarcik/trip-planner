import { afterEach, describe, expect, test } from 'bun:test';
import type { z } from 'zod';
import type { ViralTabSchema, RestaurantsTabSchema, ItineraryTabSchema } from '$lib/schemas';
import {
	findWikimediaImage,
	backfillViralImages,
	backfillRestaurantImages,
	backfillItineraryImages
} from './images.service';

type ViralTab = z.infer<typeof ViralTabSchema>;
type RestaurantsTab = z.infer<typeof RestaurantsTabSchema>;
type ItineraryTab = z.infer<typeof ItineraryTabSchema>;

const WIKI_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Foo.jpg/1024px-Foo.jpg';

const realFetch = global.fetch;
afterEach(() => {
	global.fetch = realFetch;
});

/** A MediaWiki `generator=search` + `pageimages` response for one page. */
function wikiResponse(title: string, source?: string) {
	return {
		query: {
			pages: {
				'1': { index: 1, title, ...(source ? { thumbnail: { source } } : {}) }
			}
		}
	};
}

/** Stub global fetch; `handler` maps the gsrsearch query to a JSON body (or throws). */
function stubFetch(handler: (query: string) => { ok?: boolean; body?: unknown } | 'throw') {
	global.fetch = (async (input: string | URL) => {
		const url = new URL(typeof input === 'string' ? input : input.toString());
		const query = url.searchParams.get('gsrsearch') ?? '';
		const result = handler(query);
		if (result === 'throw') throw new Error('network down');
		return {
			ok: result.ok ?? true,
			json: async () => result.body
		} as Response;
	}) as unknown as typeof fetch;
}

describe('findWikimediaImage', () => {
	test('returns a hotlinkable Wikimedia image from the top hit', async () => {
		stubFetch(() => ({ body: wikiResponse('Gergeti Trinity Church', WIKI_URL) }));
		const img = await findWikimediaImage('Gergeti Trinity Church, Kazbegi');
		expect(img).toEqual({
			url: WIKI_URL,
			alt: 'Gergeti Trinity Church, Kazbegi',
			credit: 'Wikimedia Commons'
		});
	});

	test('honors an explicit alt override', async () => {
		stubFetch(() => ({ body: wikiResponse('Gergeti Trinity Church', WIKI_URL) }));
		const img = await findWikimediaImage('Gergeti Trinity Church, Kazbegi', 'Gergeti church');
		expect(img?.alt).toBe('Gergeti church');
	});

	test('returns null when there are no search results', async () => {
		stubFetch(() => ({ body: { query: {} } }));
		expect(await findWikimediaImage('nowhere at all')).toBeNull();
	});

	test('returns null when the top hit has no thumbnail', async () => {
		stubFetch(() => ({ body: wikiResponse('Some Page') }));
		expect(await findWikimediaImage('some page')).toBeNull();
	});

	test('rejects a non-Wikimedia URL', async () => {
		stubFetch(() => ({ body: wikiResponse('Spoofed', 'https://evil.example.com/x.jpg') }));
		expect(await findWikimediaImage('spoofed')).toBeNull();
	});

	test('returns null on a non-OK response', async () => {
		stubFetch(() => ({ ok: false, body: {} }));
		expect(await findWikimediaImage('anything')).toBeNull();
	});

	test('returns null when the request throws (timeout/network)', async () => {
		stubFetch(() => 'throw');
		expect(await findWikimediaImage('anything')).toBeNull();
	});

	test('returns null for an empty query without calling fetch', async () => {
		let called = false;
		global.fetch = (async () => {
			called = true;
			return { ok: true, json: async () => ({}) } as Response;
		}) as unknown as typeof fetch;
		expect(await findWikimediaImage('   ')).toBeNull();
		expect(called).toBe(false);
	});
});

describe('backfillViralImages', () => {
	const viralTab = (image?: { url: string; alt: string }) => ({
		callout: 'Hot right now',
		note: 'note',
		sections: [
			{
				label: 'Must-see',
				spots: [
					{
						color: 'fire' as const,
						heat: 'fire' as const,
						icon: '⛰️',
						title: 'Already Set',
						location: 'Kazbegi',
						description: 'has an image',
						tags: ['a'],
						image: { url: 'https://upload.wikimedia.org/existing.jpg', alt: 'existing' }
					},
					{
						color: 'sky' as const,
						heat: 'hot' as const,
						icon: '🏛️',
						title: 'Needs Image',
						location: 'Tbilisi',
						description: 'no image yet',
						tags: ['b'],
						...(image ? { image } : {})
					}
				]
			}
		]
	});

	test('fills missing spot images and leaves existing ones untouched', async () => {
		stubFetch(() => ({ body: wikiResponse('Needs Image', WIKI_URL) }));
		const out = (await backfillViralImages(viralTab())) as ViralTab;
		const [preset, filled] = out.sections[0].spots;
		expect(preset.image?.url).toBe('https://upload.wikimedia.org/existing.jpg');
		expect(filled.image).toEqual({
			url: WIKI_URL,
			alt: 'Needs Image',
			credit: 'Wikimedia Commons'
		});
	});

	test('leaves the spot imageless when no photo is found', async () => {
		stubFetch(() => ({ body: { query: {} } }));
		const out = (await backfillViralImages(viralTab())) as ViralTab;
		expect(out.sections[0].spots[1].image).toBeUndefined();
	});

	test('returns the payload untouched when it does not parse', async () => {
		const garbage = { not: 'a viral tab' };
		expect(await backfillViralImages(garbage)).toBe(garbage);
	});
});

describe('backfillRestaurantImages', () => {
	const restaurantTab = () => ({
		callout: 'Eat here',
		note: 'note',
		cities: [
			{
				city: 'Tokyo',
				places: [
					{
						category: 'food' as const,
						name: 'Narisawa',
						location: 'Minato',
						description: 'tasting menu',
						rating: 4.6,
						ratingCount: 1200,
						tags: ['fine-dining']
					},
					{
						category: 'coffee' as const,
						name: 'Blue Bottle',
						location: 'Shibuya',
						description: 'coffee',
						rating: 4.3,
						ratingCount: 800,
						tags: ['coffee']
					}
				]
			}
		]
	});

	test('relevance guard: fills a matching page, skips a non-matching one', async () => {
		// "Narisawa" → page titled "Narisawa" (matches); "Blue Bottle" → page "Tokyo" (no overlap).
		stubFetch((query) =>
			query.startsWith('Narisawa')
				? { body: wikiResponse('Narisawa', WIKI_URL) }
				: { body: wikiResponse('Tokyo', WIKI_URL) }
		);
		const out = (await backfillRestaurantImages(restaurantTab())) as RestaurantsTab;
		const [narisawa, blueBottle] = out.cities[0].places;
		expect(narisawa.image).toEqual({ url: WIKI_URL, alt: 'Narisawa', credit: 'Wikimedia Commons' });
		expect(blueBottle.image).toBeUndefined();
	});
});

describe('backfillItineraryImages', () => {
	const itineraryTab = () => ({
		callout: 'Three days in Tokyo',
		days: [
			{
				number: 1,
				date: 'Dec 20',
				flag: '🇯🇵',
				title: 'Arrival & easy first night',
				subtitle: 'Shrines and skylines',
				countryHeader: { flag: '🇯🇵', name: 'Japan', nights: '3 nights' },
				items: [
					{
						kind: 'activity' as const,
						icon: '⛩️',
						title: 'Meiji Shrine',
						description: 'forest shrine',
						coords: { lat: 35.6764, lng: 139.6993 }
					},
					{
						kind: 'activity' as const,
						icon: '🥐',
						title: 'Breakfast',
						description: 'generic stop — never looked up (Wikipedia has a "Breakfast" page)',
						coords: { lat: 35.66, lng: 139.7 }
					},
					{
						kind: 'activity' as const,
						icon: '🍜',
						title: 'Lunch at Ichiran',
						description: 'generic word + a place → looked up; page "Tokyo" fails the guard',
						coords: { lat: 35.661, lng: 139.701 }
					},
					{
						kind: 'activity' as const,
						icon: '🎨',
						title: 'teamLab Planets',
						description: 'no coords → never looked up'
					},
					{
						kind: 'leg' as const,
						icon: '🚆',
						title: 'Shinjuku Station',
						description: 'legs are not places',
						coords: { lat: 35.69, lng: 139.7 }
					},
					{
						kind: 'activity' as const,
						icon: '🏯',
						title: 'Already Set',
						description: 'keeps its image',
						coords: { lat: 35.68, lng: 139.75 },
						image: { url: 'https://upload.wikimedia.org/existing.jpg', alt: 'existing' }
					}
				]
			}
		]
	});

	test('fills matching coord-bearing activities; skips generic, coord-less, leg and preset items', async () => {
		const queries: string[] = [];
		stubFetch((query) => {
			queries.push(query);
			// "Meiji Shrine, Japan" → page "Meiji Shrine" (matches);
			// "Breakfast, …" would hit the "Breakfast" article — it must never be asked;
			// "Ichiran, Japan" / "Lunch at Ichiran, Japan" → page "Tokyo" (guard rejects).
			if (query.startsWith('Meiji')) return { body: wikiResponse('Meiji Shrine', WIKI_URL) };
			if (query.startsWith('Breakfast')) return { body: wikiResponse('Breakfast', WIKI_URL) };
			return { body: wikiResponse('Tokyo', WIKI_URL) };
		});
		const out = (await backfillItineraryImages(itineraryTab())) as ItineraryTab;
		const [meiji, breakfast, lunch, teamlab, leg, preset] = out.days[0].items;

		expect(meiji.kind === 'activity' && meiji.image).toEqual({
			url: WIKI_URL,
			alt: 'Meiji Shrine',
			credit: 'Wikimedia Commons'
		});
		expect(breakfast.kind === 'activity' && breakfast.image).toBeFalsy();
		expect(lunch.kind === 'activity' && lunch.image).toBeFalsy();
		expect(teamlab.kind === 'activity' && teamlab.image).toBeFalsy();
		expect('image' in leg).toBe(false);
		expect(preset.kind === 'activity' && preset.image?.url).toBe(
			'https://upload.wikimedia.org/existing.jpg'
		);

		// Only coord-bearing, imageless, non-generic activities were looked up. The
		// hint is the country header, never the (thematic) day title; a descriptive
		// title tries its place phrase first, then the full title.
		expect(queries.sort()).toEqual([
			'Ichiran, Japan',
			'Lunch at Ichiran, Japan',
			'Meiji Shrine, Japan'
		]);
	});

	test('descriptive titles: the place phrase wins and a page matching only the filler is rejected', async () => {
		const queries: string[] = [];
		stubFetch((query) => {
			queries.push(query);
			// The phrase query finds the venue; a bare "Sunset" page would share a
			// token with the full title but not with the place phrase.
			if (query.startsWith('Holzmarkt')) return { body: wikiResponse('Holzmarkt', WIKI_URL) };
			if (query.startsWith('Brandenburg')) return { body: wikiResponse('Sunset', WIKI_URL) };
			return { body: wikiResponse('Sunset', WIKI_URL) };
		});
		const out = (await backfillItineraryImages({
			callout: '',
			days: [
				{
					number: 1,
					date: 'Jul 8',
					flag: '🇩🇪',
					title: 'Arrival & easy first night',
					subtitle: '',
					countryHeader: { flag: '🇩🇪', name: 'Germany', nights: '4 nights' },
					items: [
						{
							kind: 'activity',
							icon: '🌇',
							title: 'Sunset drinks at Holzmarkt 25',
							description: '',
							coords: { lat: 52.51, lng: 13.42 }
						},
						{
							kind: 'activity',
							icon: '🚶',
							title: 'Walk to Brandenburg Gate',
							description: 'every lookup returns the irrelevant "Sunset" page',
							coords: { lat: 52.516, lng: 13.377 }
						},
						{
							kind: 'activity',
							icon: '💻',
							title: 'Conference — Day 2',
							description: 'tail "Day 2" is generic → phrase ignored; whole title still searched',
							coords: { lat: 52.5, lng: 13.4 }
						}
					]
				}
			]
		})) as ItineraryTab;
		const [holzmarkt, gate, conference] = out.days[0].items;
		expect(holzmarkt.kind === 'activity' && holzmarkt.image?.alt).toBe(
			'Sunset drinks at Holzmarkt 25'
		);
		expect(gate.kind === 'activity' && gate.image).toBeFalsy();
		expect(conference.kind === 'activity' && conference.image).toBeFalsy();
		expect(queries).toContain('Holzmarkt 25, Germany');
		expect(queries).toContain('Brandenburg Gate, Germany');
		expect(queries).toContain('Walk to Brandenburg Gate, Germany');
		// The phrase hit short-circuits: the full-title query is never sent.
		expect(queries).not.toContain('Sunset drinks at Holzmarkt 25, Germany');
	});

	test('survives a thrown fetch and leaves stops imageless', async () => {
		stubFetch(() => 'throw');
		const out = (await backfillItineraryImages(itineraryTab())) as ItineraryTab;
		const meiji = out.days[0].items[0];
		expect(meiji.kind === 'activity' && meiji.image).toBeFalsy();
	});

	test('returns the payload untouched when it does not parse', async () => {
		const garbage = { not: 'an itinerary' };
		expect(await backfillItineraryImages(garbage)).toBe(garbage);
	});

	test('a coord-less itinerary issues no requests', async () => {
		let called = false;
		global.fetch = (async () => {
			called = true;
			return { ok: true, json: async () => ({}) } as Response;
		}) as unknown as typeof fetch;
		await backfillItineraryImages({
			callout: '',
			days: [
				{
					number: 1,
					date: 'Dec 20',
					flag: '🇯🇵',
					title: 'Tokyo',
					subtitle: '',
					items: [{ kind: 'activity', icon: '🎨', title: 'Museum', description: '' }]
				}
			]
		});
		expect(called).toBe(false);
	});
});
