import { api } from '$convex/_generated/api';
import { type Folder } from '$lib/schemas';
import { convex, ownerSecret } from '../data/convex';
import { isViewerMode } from '../env.server';

function assertWritable(): void {
	if (isViewerMode()) throw new Error('This deployment is read-only');
}

export async function listFolders(): Promise<Folder[]> {
	return (await convex().query(api.folders.listFolders, {})) as Folder[];
}

export async function createFolder(name: string): Promise<string> {
	assertWritable();
	// Slug generation + uniqueness happen inside the Convex mutation.
	return await convex().mutation(api.folders.createFolder, { secret: ownerSecret(), name });
}

export async function renameFolder(id: string, name: string): Promise<void> {
	assertWritable();
	await convex().mutation(api.folders.renameFolder, { secret: ownerSecret(), id, name });
}

export async function deleteFolder(id: string): Promise<void> {
	assertWritable();
	// The Convex mutation also unassigns the folder's trips in the same transaction,
	// so there are never dangling folderId references.
	await convex().mutation(api.folders.deleteFolder, { secret: ownerSecret(), id });
}
