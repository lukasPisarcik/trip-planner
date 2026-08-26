import { api } from '$convex/_generated/api';
import { formatZodErrors } from '$lib/helpers/formatZodErrors';
import { TripSchema, type TripHeadlinePatch } from '$lib/schemas';
import { type Day, type Trip } from '$lib/trips';
import { convex, ownerSecret } from '../data/convex';
import { isViewerMode } from '../env.server';
import {
	backfillTripImages,
	backfillViralImages,
	backfillRestaurantImages,
	backfillAccommodationImages
} from './images.service';

// Reads come live from Convex in every mode. Writes are gated: VIEWER_MODE blocks
// them here (a fast, clear failure), and the Convex mutations independently require
// the owner secret — which the read-only deployment never holds.
function assertWritable(): void {
	if (isViewerMode()) throw new Error('This deployment is read-only');
}

export async function listTrips(): Promise<Trip[]> {
	return (await convex().query(api.trips.listTrips, {})) as Trip[];
}

export async function getTrip(slug: string): Promise<Trip | null> {
	return (await convex().query(api.trips.getTrip, { slug })) as Trip | null;
}

// Schema-valid empty shells for the six core tabs. A skeleton `create_trip` fills
// absent tabs with these so the trip renders immediately and each later tab write
// is its own small checkpoint (a mid-build abort keeps all completed writes).
function emptyTripTabs() {
	return {
		itinerary: { callout: '', days: [] },
		transport: { callout: '', groups: [], note: '' },
		viral: { callout: '', sections: [], note: '' },
		flights: { sectionLabel: '', primary: [], secondary: [], note: '' },
		budget: { variants: [], totalNote: '' },
		tips: { sectionLabel: '', cards: [], note: '' }
	};
}

export async function createTrip(input: unknown): Promise<string> {
	assertWritable();
	// Merge the (possibly skeleton) input over the empty shells. Drop explicit
	// `undefined` values so an optional-but-present key can't clobber a shell.
	const skeleton = Object.fromEntries(
		Object.entries((input ?? {}) as Record<string, unknown>).filter(([, v]) => v !== undefined)
	);
	const assembled = { ...emptyTripTabs(), ...skeleton };
	// Guarantee the assembled trip is a valid Trip *here* — the Convex mutation
	// re-validates, but failing fast gives the agent an actionable error.
	const parsed = TripSchema.safeParse(assembled);
	if (!parsed.success) {
		// formatZodErrors returns structured issue objects — stringify them so the
		// agent sees which field failed instead of "[object Object]".
		throw new Error(
			`create_trip payload invalid: ${JSON.stringify(formatZodErrors(parsed.error))}`
		);
	}
	// Backfill any viral-spot/restaurant images the agent left empty (best-effort).
	const trip = await backfillTripImages(parsed.data);
	return await convex().mutation(api.trips.createTrip, { secret: ownerSecret(), trip });
}

export async function upsertItineraryDays(slug: string, days: Day[]): Promise<void> {
	assertWritable();
	// The day-number merge happens inside the Convex mutation (one transaction),
	// so overlapping chunk writes from parallel tool calls can't clobber each
	// other. The merge logic itself lives in $lib/helpers/mergeItineraryDays.
	await convex().mutation(api.trips.upsertItineraryDays, {
		secret: ownerSecret(),
		slug,
		days
	});
}

export async function updateTripFields(slug: string, patch: TripHeadlinePatch): Promise<void> {
	assertWritable();
	await convex().mutation(api.trips.updateTripFields, {
		secret: ownerSecret(),
		slug,
		fields: patch
	});
}

export async function replaceTripTab(
	slug: string,
	tab:
		| 'itinerary'
		| 'transport'
		| 'viral'
		| 'flights'
		| 'budget'
		| 'tips'
		| 'restaurants'
		| 'accommodation'
		| 'brainstorm',
	payload: unknown
): Promise<void> {
	assertWritable();
	// Backfill any images the agent left empty before persisting (best-effort).
	let body = payload;
	if (tab === 'viral') body = await backfillViralImages(payload);
	else if (tab === 'restaurants') body = await backfillRestaurantImages(payload);
	else if (tab === 'accommodation') body = await backfillAccommodationImages(payload);
	await convex().mutation(api.trips.replaceTripTab, {
		secret: ownerSecret(),
		slug,
		tab,
		payload: body
	});
}

export async function setTripFavorite(slug: string, favorite: boolean): Promise<void> {
	assertWritable();
	await convex().mutation(api.trips.setTripFavorite, { secret: ownerSecret(), slug, favorite });
}

export async function moveTripToFolder(slug: string, folderId: string | null): Promise<void> {
	assertWritable();
	await convex().mutation(api.trips.moveTripToFolder, { secret: ownerSecret(), slug, folderId });
}

export async function deleteTrip(slug: string): Promise<void> {
	assertWritable();
	await convex().mutation(api.trips.deleteTrip, { secret: ownerSecret(), slug });
}
