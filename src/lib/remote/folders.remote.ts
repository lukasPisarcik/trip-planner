import { command } from '$app/server';
import { CreateFolderInput, RenameFolderInput, FolderIdInput } from '$lib/schemas';
import * as foldersService from '$lib/server/services/folders.service';

// Folder reads are served reactively to the client via convex-svelte `useQuery`
// (api.folders.listFolders).
export const createFolder = command(CreateFolderInput, async ({ name }) => {
	const id = await foldersService.createFolder(name);
	return { id } as const;
});

export const renameFolder = command(RenameFolderInput, async ({ id, name }) => {
	await foldersService.renameFolder(id, name);
	return { ok: true } as const;
});

export const deleteFolder = command(FolderIdInput, async ({ id }) => {
	await foldersService.deleteFolder(id);
	return { ok: true } as const;
});
