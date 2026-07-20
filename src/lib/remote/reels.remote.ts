import { command } from '$app/server';
import {
	SaveReelInput,
	ReelIdInput,
	MoveReelToFolderInput,
	CreateReelFolderInput,
	RenameReelFolderInput,
	ReelFolderIdInput
} from '$lib/schemas';
import * as reelsService from '$lib/server/services/reels.service';

// Reel + reel-folder reads are served reactively to the client via convex-svelte
// `useQuery` (api.reels.listReels / listReelFolders). These commands are the write path.
export const saveReel = command(SaveReelInput, async ({ url, folderId }) => {
	const id = await reelsService.saveReel(url, folderId ?? null);
	return { id } as const;
});

export const deleteReel = command(ReelIdInput, async ({ id }) => {
	await reelsService.deleteReel(id);
	return { ok: true } as const;
});

export const moveReelToFolder = command(MoveReelToFolderInput, async ({ id, folderId }) => {
	await reelsService.moveReelToFolder(id, folderId);
	return { ok: true } as const;
});

export const retryReelExtraction = command(ReelIdInput, async ({ id }) => {
	await reelsService.retryReelExtraction(id);
	return { ok: true } as const;
});

export const createReelFolder = command(CreateReelFolderInput, async ({ name }) => {
	const id = await reelsService.createReelFolder(name);
	return { id } as const;
});

export const renameReelFolder = command(RenameReelFolderInput, async ({ id, name }) => {
	await reelsService.renameReelFolder(id, name);
	return { ok: true } as const;
});

export const deleteReelFolder = command(ReelFolderIdInput, async ({ id }) => {
	await reelsService.deleteReelFolder(id);
	return { ok: true } as const;
});
