/**
 * Publish script — bake the local trip data into a committed snapshot that the
 * read-only deployment (`VIEWER_MODE=true`) serves.
 *
 * Usage: `bun run snapshot`, then commit + push. Vercel redeploys with the
 * updated trips. The live file-store (`.data/trips.json`) and the seed modules
 * in `src/lib/trips/local/` stay local/gitignored — only this snapshot ships.
 */

interface StoredTrip {
	createdAt?: number;
	updatedAt?: number;
	[key: string]: unknown;
}

const SRC = '.data/trips.json';
const DEST = 'src/lib/trips/data/snapshot.json';

const source = Bun.file(SRC);
if (!(await source.exists())) {
	console.error(`No ${SRC} found — create some trips locally first (bun run dev).`);
	process.exit(1);
}

const records = (await source.json()) as StoredTrip[];

// Match `listTrips` ordering (createdAt asc) and strip the persistence-only
// timestamps so the snapshot is a clean `Trip[]`.
const trips = [...records]
	.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
	.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...trip }) => trip);

await Bun.write(DEST, JSON.stringify(trips, null, 2) + '\n');
console.log(`Wrote ${trips.length} trip(s) → ${DEST}`);
