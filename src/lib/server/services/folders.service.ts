import { z } from 'zod';
import { log, formatZodErrors } from '$lib';
import { FolderSchema, type Folder } from '$lib/schemas';
import snapshotJson from '$lib/trips/data/folders-snapshot.json';
import { createFileStore } from '../data/store';
import { isViewerMode } from '../env.server';
import * as tripsService from './trips.service';

// Persisted shape adds a creation timestamp for stable ordering; stripped before
// data reaches callers (mirrors TripRecord in trips.service.ts).
interface FolderRecord extends Folder {
	createdAt: number;
}

const foldersStore = createFileStore<FolderRecord[]>('folders.json', () => []);

function toFolder(record: FolderRecord): Folder {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { createdAt, ...folder } = record;
	return folder;
}

// Read-only deployments (VIEWER_MODE) serve the committed folders snapshot, parsed
// and cached once — same pattern as snapshotTrips().
let snapshotCache: Folder[] | null = null;
function snapshotFolders(): Folder[] {
	if (snapshotCache) return snapshotCache;
	const parsed = z.array(FolderSchema).safeParse(snapshotJson);
	if (!parsed.success) {
		log.error(
			{ validationError: formatZodErrors(parsed.error) },
			'Invalid folders snapshot; serving an empty list'
		);
		snapshotCache = [];
	} else {
		snapshotCache = parsed.data;
	}
	return snapshotCache;
}

function assertWritable(): void {
	if (isViewerMode()) throw new Error('This deployment is read-only');
}

// Derive a URL/JSON-safe, unique folder id from a display name.
function slugifyUnique(name: string, existing: FolderRecord[]): string {
	const base =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-{2,}/g, '-') || 'folder';
	const taken = new Set(existing.map((f) => f.id));
	if (!taken.has(base)) return base;
	let n = 2;
	while (taken.has(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}

export async function listFolders(): Promise<Folder[]> {
	if (isViewerMode()) return snapshotFolders();
	const records = await foldersStore.read();
	return [...records].sort((a, b) => a.createdAt - b.createdAt).map(toFolder);
}

export async function createFolder(name: string): Promise<string> {
	assertWritable();
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Folder name required');
	const records = await foldersStore.read();
	const id = slugifyUnique(trimmed, records);
	log.info({ id, name: trimmed }, 'Creating folder');
	await foldersStore.write([...records, { id, name: trimmed, createdAt: Date.now() }]);
	return id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
	assertWritable();
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Folder name required');
	const records = await foldersStore.read();
	const idx = records.findIndex((r) => r.id === id);
	if (idx === -1) throw new Error(`Folder "${id}" not found`);
	const next = [...records];
	next[idx] = { ...next[idx], name: trimmed };
	await foldersStore.write(next);
	log.info({ id, name: trimmed }, 'Renamed folder');
}

export async function deleteFolder(id: string): Promise<void> {
	assertWritable();
	// Unassign the folder's trips first so we never leave dangling folderId refs,
	// then drop the folder record.
	await tripsService.unassignFolder(id);
	const records = await foldersStore.read();
	await foldersStore.write(records.filter((r) => r.id !== id));
	log.info({ id }, 'Deleted folder');
}
