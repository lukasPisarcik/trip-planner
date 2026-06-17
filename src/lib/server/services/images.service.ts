import { ViralTabSchema, RestaurantsTabSchema, TripSchema, type TripImage } from '$lib/schemas';

// Resolves real, hotlinkable photos for viral spots and restaurants from
// Wikimedia, so the agent never has to guess an `upload.wikimedia.org` URL (it
// can't — see the `find_image` tool) and the write path can backfill anything the
// agent still left empty. Everything here is best-effort: a failed lookup returns
// null/leaves the item imageless and never throws into the Convex write path.
//
// Kept dependency-light on purpose (only Zod schemas) so it stays runnable under
// `bun test` — importing the pino logger would pull in `$app/environment`.

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
// Wikimedia asks for a descriptive User-Agent identifying the app.
const USER_AGENT = 'trip-planner/0.1 (personal travel planner; +https://github.com/)';
const LOOKUP_TIMEOUT_MS = 5000;
// Be polite to the Wikimedia API when backfilling many items at once.
const BACKFILL_CONCURRENCY = 4;

interface WikimediaHit {
	image: TripImage;
	/** The matched Wikipedia page title — used for the restaurant relevance guard. */
	pageTitle: string;
}

/** Shape of the slice of the MediaWiki `query` response we read. */
interface WikiPage {
	index?: number;
	title?: string;
	thumbnail?: { source?: string };
}

/**
 * Look up the lead image of the top Wikipedia search hit for `query`. Returns a
 * hotlinkable Wikimedia thumbnail plus the matched page title, or null when there
 * is no result / no image / anything goes wrong.
 */
async function lookupWikimedia(query: string): Promise<WikimediaHit | null> {
	const trimmed = query.trim();
	if (!trimmed) return null;

	const url = `${WIKI_API}?${new URLSearchParams({
		action: 'query',
		format: 'json',
		prop: 'pageimages',
		piprop: 'thumbnail',
		pithumbsize: '1024',
		generator: 'search',
		gsrsearch: trimmed,
		gsrlimit: '1',
		gsrnamespace: '0'
	})}`;

	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
			signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
		});
		if (!res.ok) return null;

		const data = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
		const pages = data.query?.pages;
		if (!pages) return null;

		// `generator=search` keys pages by id; pick the best-ranked (lowest index).
		const page = Object.values(pages).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
		const source = page?.thumbnail?.source;
		if (!source || !isHotlinkableWikimedia(source)) return null;

		return {
			image: { url: source, alt: trimmed, credit: 'Wikimedia Commons' },
			pageTitle: page.title ?? trimmed
		};
	} catch {
		// Timeout, network error, bad JSON — treat as "no image found".
		return null;
	}
}

/** A valid, hotlinkable image URL hosted on Wikimedia. */
function isHotlinkableWikimedia(url: string): boolean {
	try {
		const u = new URL(url);
		return (
			(u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.endsWith('wikimedia.org')
		);
	} catch {
		return false;
	}
}

/**
 * Public lookup used by the `find_image` tool and the viral-spot backfill. Returns
 * a ready-to-store `{ url, alt, credit }` or null. `altText` overrides the alt text
 * (defaults to the query).
 */
export async function findWikimediaImage(
	query: string,
	altText?: string
): Promise<TripImage | null> {
	const hit = await lookupWikimedia(query);
	if (!hit) return null;
	return altText ? { ...hit.image, alt: altText } : hit.image;
}

// ---------------------------------------------------------------------------
// Backfill helpers — fill in `image` only where the agent left it empty. They
// parse the payload with the existing schemas; if it doesn't parse we return it
// untouched and let Convex be the authoritative validator.
// ---------------------------------------------------------------------------

/** Run `fn` over `items` with a bounded concurrency, preserving order. */
async function pooledMap<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return out;
}

/**
 * Does the matched Wikipedia page title plausibly refer to this place? Restaurant
 * names resolve poorly on Wikimedia (a blind top-hit is often the city page or an
 * unrelated entity), so we require a shared significant (≥3-char) token. Viral
 * spots are landmarks and skip this guard.
 */
function titleMatchesPlace(pageTitle: string, placeName: string): boolean {
	const tokens = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, ' ')
			.split(/\s+/)
			.filter((w) => w.length >= 3);
	const wanted = new Set(tokens(placeName));
	return tokens(pageTitle).some((t) => wanted.has(t));
}

/** Backfill missing `image` on viral spots. Input/output are the raw tab payload. */
export async function backfillViralImages(payload: unknown): Promise<unknown> {
	const parsed = ViralTabSchema.safeParse(payload);
	if (!parsed.success) return payload;
	const tab = parsed.data;

	const missing = tab.sections.flatMap((section) => section.spots.filter((spot) => !spot.image));
	await pooledMap(missing, BACKFILL_CONCURRENCY, async (spot) => {
		const image = await findWikimediaImage(`${spot.title}, ${spot.location}`, spot.title);
		if (image) spot.image = image;
	});
	return tab;
}

/** Backfill missing `image` on restaurants (with the relevance guard). */
export async function backfillRestaurantImages(payload: unknown): Promise<unknown> {
	const parsed = RestaurantsTabSchema.safeParse(payload);
	if (!parsed.success) return payload;
	const tab = parsed.data;

	const missing = tab.cities.flatMap((city) =>
		city.places.filter((place) => !place.image).map((place) => ({ place, city: city.city }))
	);
	await pooledMap(missing, BACKFILL_CONCURRENCY, async ({ place, city }) => {
		const hit = await lookupWikimedia(`${place.name}, ${city}`);
		if (hit && titleMatchesPlace(hit.pageTitle, place.name)) {
			place.image = { ...hit.image, alt: place.name };
		}
	});
	return tab;
}

/** Backfill viral + restaurant images on a whole trip object (for `create_trip`). */
export async function backfillTripImages(trip: unknown): Promise<unknown> {
	const parsed = TripSchema.safeParse(trip);
	if (!parsed.success) return trip;
	const data = parsed.data;

	data.viral = (await backfillViralImages(data.viral)) as typeof data.viral;
	if (data.restaurants) {
		data.restaurants = (await backfillRestaurantImages(
			data.restaurants
		)) as typeof data.restaurants;
	}
	return data;
}
