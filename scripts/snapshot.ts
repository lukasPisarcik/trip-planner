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
const FOLDERS_SRC = '.data/folders.json';
const FOLDERS_DEST = 'src/lib/trips/data/folders-snapshot.json';

const source = Bun.file(SRC);
if (!(await source.exists())) {
	console.error(`No ${SRC} found — create some trips locally first (bun run dev).`);
	process.exit(1);
}

const records = (await source.json()) as StoredTrip[];

// Match `listTrips` ordering (createdAt asc) and strip the persistence-only
// timestamps so the snapshot is a clean `Trip[]`. `folderId` rides along via the
// spread, so trip → folder grouping survives into viewer mode.
const trips = [...records]
	.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
	.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...trip }) => trip);

await Bun.write(DEST, JSON.stringify(trips, null, 2) + '\n');
console.log(`Wrote ${trips.length} trip(s) → ${DEST}`);

// Folders are optional — bake them too if any exist, else publish an empty list
// (the file must exist for folders.service's static import to resolve).
const folderSource = Bun.file(FOLDERS_SRC);
const folderRecords = (await folderSource.exists())
	? ((await folderSource.json()) as StoredTrip[])
	: [];
const folders = [...folderRecords]
	.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
	.map(({ createdAt: _createdAt, ...folder }) => folder);

await Bun.write(FOLDERS_DEST, JSON.stringify(folders, null, 2) + '\n');
console.log(`Wrote ${folders.length} folder(s) → ${FOLDERS_DEST}`);
