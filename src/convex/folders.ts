import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import { assertOwner } from './lib/secret';

// "My Folder" -> "my-folder"; falls back to "folder" if all non-alphanumeric.
function slugify(name: string): string {
	const base = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return base || 'folder';
}

async function uniqueSlug(ctx: MutationCtx, name: string): Promise<string> {
	const base = slugify(name);
	const taken = new Set((await ctx.db.query('folders').collect()).map((f) => f.id));
	if (!taken.has(base)) return base;
	let n = 2;
	while (taken.has(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}

// ---- Reads (public, reactive) ----

export const listFolders = query({
	args: {},
	handler: async (ctx) => {
		const docs = await ctx.db.query('folders').collect();
		return docs.sort((a, b) => a.createdAt - b.createdAt).map((f) => ({ id: f.id, name: f.name }));
	}
});

// ---- Writes (secret-gated) ----

export const createFolder = mutation({
	args: { secret: v.string(), name: v.string() },
	handler: async (ctx, { secret, name }) => {
		assertOwner(secret);
		const trimmed = name.trim();
		if (!trimmed) throw new Error('Folder name is required');
		const id = await uniqueSlug(ctx, trimmed);
		await ctx.db.insert('folders', { id, name: trimmed, createdAt: Date.now() });
		return id;
	}
});

export const renameFolder = mutation({
	args: { secret: v.string(), id: v.string(), name: v.string() },
	handler: async (ctx, { secret, id, name }) => {
		assertOwner(secret);
		const trimmed = name.trim();
		if (!trimmed) throw new Error('Folder name is required');
		const doc = await ctx.db
			.query('folders')
			.withIndex('by_slug', (q) => q.eq('id', id))
			.unique();
		if (!doc) throw new Error(`Folder "${id}" not found`);
		await ctx.db.patch(doc._id, { name: trimmed });
	}
});

export const deleteFolder = mutation({
	args: { secret: v.string(), id: v.string() },
	handler: async (ctx, { secret, id }) => {
		assertOwner(secret);
		// Cascade in one transaction: clear folderId on every trip in this folder,
		// then delete the folder — so we never leave dangling folderId references.
		const trips = await ctx.db
			.query('trips')
			.withIndex('by_folder', (q) => q.eq('folderId', id))
			.collect();
		const now = Date.now();
		for (const t of trips) {
			await ctx.db.patch(t._id, {
				folderId: null,
				data: { ...t.data, folderId: null },
				updatedAt: now
			});
		}
		const folder = await ctx.db
			.query('folders')
			.withIndex('by_slug', (q) => q.eq('id', id))
			.unique();
		if (folder) await ctx.db.delete(folder._id);
	}
});
