import { z } from 'zod';
import { log, formatZodErrors } from '$lib';
import { TripSchema, TripHeadlinePatchSchema, type TripHeadlinePatch } from '$lib/schemas';
import { trips as seedTrips, type Trip } from '$lib/trips';
import snapshotJson from '$lib/trips/data/snapshot.json';
import { createFileStore } from '../data/store';
import { isViewerMode } from '../env.server';

// Persisted shape adds insertion/modification timestamps. The Trip type stays
// clean — timestamps are stripped before handing data back to callers.
interface TripRecord extends Trip {
	createdAt: number;
	updatedAt: number;
}

const tripsStore = createFileStore<TripRecord[]>('trips.json', () => {
	const now = Date.now();
	return seedTrips.map((trip) => ({ ...trip, createdAt: now, updatedAt: now }));
});

function toTrip(record: TripRecord): Trip {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { createdAt, updatedAt, ...trip } = record;
	return trip;
}

// Read-only public deployments (VIEWER_MODE) can't touch the Bun file-store —
// the serverless filesystem is read-only and `Bun.*` is undefined on Node.
// Instead they serve the committed snapshot, parsed and cached once.
let snapshotCache: Trip[] | null = null;
function snapshotTrips(): Trip[] {
	if (snapshotCache) return snapshotCache;
	const parsed = z.array(TripSchema).safeParse(snapshotJson);
	if (!parsed.success) {
		log.error(
			{ validationError: formatZodErrors(parsed.error) },
			'Invalid trip snapshot; serving an empty list'
		);
		snapshotCache = [];
	} else {
		snapshotCache = parsed.data;
	}
	return snapshotCache;
}

// All trips in the snapshot are already ordered as `listTrips` would order them
// (the publish script sorts by createdAt before stripping timestamps).
function assertWritable(): void {
	if (isViewerMode()) throw new Error('This deployment is read-only');
}

export async function listTrips(): Promise<Trip[]> {
	if (isViewerMode()) return snapshotTrips();
	const records = await tripsStore.read();
	return [...records].sort((a, b) => a.createdAt - b.createdAt).map(toTrip);
}

export async function getTrip(slug: string): Promise<Trip | null> {
	if (isViewerMode()) return snapshotTrips().find((t) => t.slug === slug) ?? null;
	const records = await tripsStore.read();
	const record = records.find((r) => r.slug === slug);
	return record ? toTrip(record) : null;
}

export async function createTrip(input: unknown): Promise<string> {
	assertWritable();
	const parsed = TripSchema.parse(input);
	log.info({ slug: parsed.slug }, 'Creating trip');
	const records = await tripsStore.read();
	if (records.some((r) => r.slug === parsed.slug)) {
		throw new Error(`Trip with slug "${parsed.slug}" already exists`);
	}
	const now = Date.now();
	const record: TripRecord = { ...parsed, createdAt: now, updatedAt: now };
	await tripsStore.write([...records, record]);
	return parsed.slug;
}

export async function updateTripFields(slug: string, patch: TripHeadlinePatch): Promise<void> {
	assertWritable();
	const fields = TripHeadlinePatchSchema.parse(patch);
	log.info({ slug, fieldCount: Object.keys(fields).length }, 'Updating trip fields');
	const records = await tripsStore.read();
	const idx = records.findIndex((r) => r.slug === slug);
	if (idx === -1) throw new Error(`Trip "${slug}" not found`);
	const next = [...records];
	next[idx] = { ...next[idx], ...fields, updatedAt: Date.now() };
	await tripsStore.write(next);
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
	// Per-tab Zod validation via TripSchema.shape[tab].
	const tabSchema = TripSchema.shape[tab];
	const parsed = tabSchema.parse(payload);
	log.info({ slug, tab }, 'Replacing trip tab');
	const records = await tripsStore.read();
	const idx = records.findIndex((r) => r.slug === slug);
	if (idx === -1) throw new Error(`Trip "${slug}" not found`);
	const next = [...records];
	next[idx] = { ...next[idx], [tab]: parsed, updatedAt: Date.now() } as TripRecord;
	await tripsStore.write(next);
}

export async function deleteTrip(slug: string): Promise<void> {
	assertWritable();
	log.info({ slug }, 'Deleting trip');
	const records = await tripsStore.read();
	await tripsStore.write(records.filter((r) => r.slug !== slug));
}
