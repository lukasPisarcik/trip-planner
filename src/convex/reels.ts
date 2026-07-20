import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { ReelSchema } from '../lib/schemas/schemas';
import { assertOwner } from './lib/secret';

// "My Reels" -> "my-reels"; falls back to "folder" if all non-alphanumeric.
function slugify(name: string): string {
	const base = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return base || 'folder';
}

async function uniqueFolderSlug(ctx: MutationCtx, name: string): Promise<string> {
	const base = slugify(name);
	const taken = new Set((await ctx.db.query('reelFolders').collect()).map((f) => f.id));
	if (!taken.has(base)) return base;
	let n = 2;
	while (taken.has(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}

async function requireReel(ctx: MutationCtx, id: string) {
	const doc = await ctx.db
		.query('reels')
		.withIndex('by_slug', (q) => q.eq('id', id))
		.unique();
	if (!doc) throw new Error(`Reel "${id}" not found`);
	return doc;
}

// ---- Reads (public, reactive) ----

// Resolves each reel's durable thumbnail (stored in Convex file storage) to a fresh
// URL for the client, so tiles survive Instagram link expiry. Newest first.
//
// This is a PUBLIC, unauthenticated query served straight to the browser via
// convex-svelte `useQuery`, so it deliberately returns ONLY the display metadata the
// grid renders. The derived intelligence — `transcript`, `onScreenText`,
// `visualDescription` — is withheld and read exclusively server-side through the
// secret-gated `getReel` below (mirroring how private chat reads are gated).
export const listReels = query({
	args: {},
	handler: async (ctx) => {
		const docs = await ctx.db.query('reels').collect();
		const sorted = docs.sort((a, b) => b.createdAt - a.createdAt);
		return await Promise.all(
			sorted.map(async (d) => {
				const storageId = d.data?.thumbnailStorageId as string | undefined;
				const thumbnailUrl = storageId
					? ((await ctx.storage.getUrl(storageId as Id<'_storage'>)) ?? undefined)
					: undefined;
				return {
					id: d.data.id,
					folderId: d.data.folderId ?? null,
					platform: d.data.platform,
					sourceUrl: d.data.sourceUrl,
					author: d.data.author,
					caption: d.data.caption,
					status: d.data.status,
					thumbnailUrl: thumbnailUrl ?? d.data?.thumbnailUrl
				};
			})
		);
	}
});

// Full reel body incl. the private extracted text. Secret-gated and only ever called
// server-side (by `reels.service.hydrateReels` / `retryReelExtraction`) — never from
// the browser — so a reel's transcript/vision text is never world-readable.
export const getReel = query({
	args: { secret: v.string(), id: v.string() },
	handler: async (ctx, { secret, id }) => {
		assertOwner(secret);
		const doc = await ctx.db
			.query('reels')
			.withIndex('by_slug', (q) => q.eq('id', id))
			.unique();
		return doc ? doc.data : null;
	}
});

export const listReelFolders = query({
	args: {},
	handler: async (ctx) => {
		const docs = await ctx.db.query('reelFolders').collect();
		return docs.sort((a, b) => a.createdAt - b.createdAt).map((f) => ({ id: f.id, name: f.name }));
	}
});

// ---- Writes (secret-gated) ----

// Inserts a reel (typically in `processing` state); the background job later fills
// its fields via `setReelExtraction`.
export const saveReel = mutation({
	args: { secret: v.string(), reel: v.any() },
	handler: async (ctx, { secret, reel }) => {
		assertOwner(secret);
		const parsed = ReelSchema.parse(reel);
		const existing = await ctx.db
			.query('reels')
			.withIndex('by_slug', (q) => q.eq('id', parsed.id))
			.unique();
		if (existing) throw new Error(`Reel with id "${parsed.id}" already exists`);
		const now = Date.now();
		await ctx.db.insert('reels', {
			id: parsed.id,
			folderId: parsed.folderId ?? null,
			status: parsed.status,
			data: parsed,
			createdAt: now,
			updatedAt: now
		});
		return parsed.id;
	}
});

// Merges extraction results into the stored reel and re-validates the whole body,
// keeping the indexed `status` column in sync.
export const setReelExtraction = mutation({
	args: { secret: v.string(), id: v.string(), fields: v.any() },
	handler: async (ctx, { secret, id, fields }) => {
		assertOwner(secret);
		const doc = await requireReel(ctx, id);
		const merged = ReelSchema.parse({ ...doc.data, ...fields });
		await ctx.db.patch(doc._id, {
			status: merged.status,
			data: merged,
			updatedAt: Date.now()
		});
	}
});

export const moveReelToFolder = mutation({
	args: { secret: v.string(), id: v.string(), folderId: v.union(v.string(), v.null()) },
	handler: async (ctx, { secret, id, folderId }) => {
		assertOwner(secret);
		const doc = await requireReel(ctx, id);
		await ctx.db.patch(doc._id, {
			folderId,
			data: { ...doc.data, folderId },
			updatedAt: Date.now()
		});
	}
});

export const deleteReel = mutation({
	args: { secret: v.string(), id: v.string() },
	handler: async (ctx, { secret, id }) => {
		assertOwner(secret);
		const doc = await ctx.db
			.query('reels')
			.withIndex('by_slug', (q) => q.eq('id', id))
			.unique();
		if (doc) await ctx.db.delete(doc._id);
	}
});

// Cover-frame upload target for the background job. The job POSTs the image here,
// then stores the returned storageId on the reel via `setReelExtraction`.
export const generateThumbnailUploadUrl = mutation({
	args: { secret: v.string() },
	handler: async (ctx, { secret }) => {
		assertOwner(secret);
		return await ctx.storage.generateUploadUrl();
	}
});

// ---- Reel folders (secret-gated writes; reads above) ----

export const createReelFolder = mutation({
	args: { secret: v.string(), name: v.string() },
	handler: async (ctx, { secret, name }) => {
		assertOwner(secret);
		const trimmed = name.trim();
		if (!trimmed) throw new Error('Folder name is required');
		const id = await uniqueFolderSlug(ctx, trimmed);
		await ctx.db.insert('reelFolders', { id, name: trimmed, createdAt: Date.now() });
		return id;
	}
});

export const renameReelFolder = mutation({
	args: { secret: v.string(), id: v.string(), name: v.string() },
	handler: async (ctx, { secret, id, name }) => {
		assertOwner(secret);
		const trimmed = name.trim();
		if (!trimmed) throw new Error('Folder name is required');
		const doc = await ctx.db
			.query('reelFolders')
			.withIndex('by_slug', (q) => q.eq('id', id))
			.unique();
		if (!doc) throw new Error(`Reel folder "${id}" not found`);
		await ctx.db.patch(doc._id, { name: trimmed });
	}
});

export const deleteReelFolder = mutation({
	args: { secret: v.string(), id: v.string() },
	handler: async (ctx, { secret, id }) => {
		assertOwner(secret);
		// Cascade: unassign the folder's reels in the same transaction so we never
		// leave dangling folderId references, then delete the folder.
		const reels = await ctx.db
			.query('reels')
			.withIndex('by_folder', (q) => q.eq('folderId', id))
			.collect();
		const now = Date.now();
		for (const r of reels) {
			await ctx.db.patch(r._id, {
				folderId: null,
				data: { ...r.data, folderId: null },
				updatedAt: now
			});
		}
		const folder = await ctx.db
			.query('reelFolders')
			.withIndex('by_slug', (q) => q.eq('id', id))
			.unique();
		if (folder) await ctx.db.delete(folder._id);
	}
});
