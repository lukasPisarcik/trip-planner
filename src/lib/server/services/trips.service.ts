import { api } from '$convex/_generated/api';
import { type TripHeadlinePatch } from '$lib/schemas';
import { type Trip } from '$lib/trips';
import { convex, ownerSecret } from '../data/convex';
import { isViewerMode } from '../env.server';
import {
	backfillTripImages,
	backfillViralImages,
	backfillRestaurantImages
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

export async function createTrip(input: unknown): Promise<string> {
	assertWritable();
	// Backfill any viral-spot/restaurant images the agent left empty (best-effort).
	const trip = await backfillTripImages(input);
	// Validation (TripSchema) happens authoritatively inside the Convex mutation.
	return await convex().mutation(api.trips.createTrip, { secret: ownerSecret(), trip });
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
		| 'brainstorm',
	payload: unknown
): Promise<void> {
	assertWritable();
	// Backfill any images the agent left empty before persisting (best-effort).
	let body = payload;
	if (tab === 'viral') body = await backfillViralImages(payload);
	else if (tab === 'restaurants') body = await backfillRestaurantImages(payload);
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
