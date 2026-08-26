import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { assertOwner } from './lib/secret';

// Strip Convex system fields (_id, _creationTime) — callers expect the ChatRecord shape.
function toRecord(doc: Doc<'chats'>) {
	return {
		sessionId: doc.sessionId,
		tripSlug: doc.tripSlug,
		provider: doc.provider,
		providerThreadId: doc.providerThreadId,
		attachedReelIds: doc.attachedReelIds,
		messages: doc.messages,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	};
}

async function bySession(ctx: QueryCtx, sessionId: string): Promise<Doc<'chats'> | null> {
	return ctx.db
		.query('chats')
		.withIndex('by_session', (q) => q.eq('sessionId', sessionId))
		.unique();
}

async function latestNonEmptyForTrip(
	ctx: QueryCtx,
	tripSlug: string | null
): Promise<Doc<'chats'> | null> {
	const docs = await ctx.db
		.query('chats')
		.withIndex('by_trip', (q) => q.eq('tripSlug', tripSlug))
		.collect();
	return (
		docs.filter((r) => r.messages.length > 0).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
	);
}

// ---- Reads (secret-gated) ----
// Unlike trips/folders, chat threads are PRIVATE AI conversations — so these
// reads also require the owner secret and are never exposed to the browser. The
// client reads chats only through the (server-side) service layer, not reactively.

export const getChatForTrip = query({
	args: { secret: v.string(), tripSlug: v.union(v.string(), v.null()) },
	handler: async (ctx, { secret, tripSlug }) => {
		assertOwner(secret);
		// "New trip" mode (null slug) always starts fresh.
		if (tripSlug === null) return null;
		const latest = await latestNonEmptyForTrip(ctx, tripSlug);
		return latest ? toRecord(latest) : null;
	}
});

export const listChats = query({
	args: { secret: v.string() },
	handler: async (ctx, { secret }) => {
		assertOwner(secret);
		const docs = await ctx.db.query('chats').collect();
		// Hide empty (abandoned) threads; most-recently-updated first.
		return docs
			.filter((r) => r.messages.length > 0)
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map(toRecord);
	}
});

export const getChatBySession = query({
	args: { secret: v.string(), sessionId: v.string() },
	handler: async (ctx, { secret, sessionId }) => {
		assertOwner(secret);
		const doc = await bySession(ctx, sessionId);
		return doc ? toRecord(doc) : null;
	}
});

// ---- Writes (secret-gated) ----

// Drop stale empty records for this trip — reusing their sessionId would collide
// with the CLI's session file from a previous failed turn.
async function dropStaleEmpty(ctx: MutationCtx, docs: Doc<'chats'>[]): Promise<void> {
	for (const r of docs) {
		if (r.messages.length === 0) await ctx.db.delete(r._id);
	}
}

export const createChat = mutation({
	args: { secret: v.string(), tripSlug: v.union(v.string(), v.null()), sessionId: v.string() },
	handler: async (ctx, { secret, tripSlug, sessionId }) => {
		assertOwner(secret);
		const sameTrip = await ctx.db
			.query('chats')
			.withIndex('by_trip', (q) => q.eq('tripSlug', tripSlug))
			.collect();
		await dropStaleEmpty(ctx, sameTrip);
		const now = Date.now();
		await ctx.db.insert('chats', {
			sessionId,
			tripSlug,
			messages: [],
			createdAt: now,
			updatedAt: now
		});
		return { sessionId, tripSlug, messages: [], createdAt: now, updatedAt: now };
	}
});

export const getOrCreateChat = mutation({
	args: { secret: v.string(), tripSlug: v.union(v.string(), v.null()), sessionId: v.string() },
	handler: async (ctx, { secret, tripSlug, sessionId }) => {
		assertOwner(secret);
		const existing = await latestNonEmptyForTrip(ctx, tripSlug);
		if (existing) return toRecord(existing);
		const sameTrip = await ctx.db
			.query('chats')
			.withIndex('by_trip', (q) => q.eq('tripSlug', tripSlug))
			.collect();
		await dropStaleEmpty(ctx, sameTrip);
		const now = Date.now();
		await ctx.db.insert('chats', {
			sessionId,
			tripSlug,
			messages: [],
			createdAt: now,
			updatedAt: now
		});
		return { sessionId, tripSlug, messages: [], createdAt: now, updatedAt: now };
	}
});

export const appendMessages = mutation({
	args: { secret: v.string(), sessionId: v.string(), messages: v.array(v.any()) },
	handler: async (ctx, { secret, sessionId, messages }) => {
		assertOwner(secret);
		if (messages.length === 0) return;
		const doc = await bySession(ctx, sessionId);
		if (!doc) throw new Error(`Chat with sessionId "${sessionId}" not found`);
		await ctx.db.patch(doc._id, {
			messages: [...doc.messages, ...messages],
			updatedAt: Date.now()
		});
	}
});

export const setTripSlug = mutation({
	args: { secret: v.string(), sessionId: v.string(), tripSlug: v.string() },
	handler: async (ctx, { secret, sessionId, tripSlug }) => {
		assertOwner(secret);
		const doc = await bySession(ctx, sessionId);
		if (!doc) throw new Error(`Chat with sessionId "${sessionId}" not found`);
		await ctx.db.patch(doc._id, { tripSlug, updatedAt: Date.now() });
	}
});

// Record which provider owns the thread + its provider-native id, so a later turn
// resumes with the right SDK. Claude's id is the app sessionId; Codex mints its own.
export const setProviderThread = mutation({
	args: {
		secret: v.string(),
		sessionId: v.string(),
		provider: v.union(v.literal('anthropic'), v.literal('openai')),
		providerThreadId: v.string()
	},
	handler: async (ctx, { secret, sessionId, provider, providerThreadId }) => {
		assertOwner(secret);
		const doc = await bySession(ctx, sessionId);
		if (!doc) throw new Error(`Chat with sessionId "${sessionId}" not found`);
		// Only called when the owning thread changed — the hydrated-reel bookkeeping
		// belongs to the OLD native thread, so reset it (the route re-records the ids
		// it hydrated into the new thread right after this).
		await ctx.db.patch(doc._id, {
			provider,
			providerThreadId,
			attachedReelIds: [],
			updatedAt: Date.now()
		});
	}
});

// Record reel ids whose context was hydrated into the thread's native session this
// turn (set-union merge, so retries and overlapping attachments stay idempotent).
// A same-provider resume consults this list to skip re-hydrating known reels.
export const addAttachedReelIds = mutation({
	args: { secret: v.string(), sessionId: v.string(), reelIds: v.array(v.string()) },
	handler: async (ctx, { secret, sessionId, reelIds }) => {
		assertOwner(secret);
		if (reelIds.length === 0) return;
		const doc = await bySession(ctx, sessionId);
		if (!doc) throw new Error(`Chat with sessionId "${sessionId}" not found`);
		const merged = [...new Set([...(doc.attachedReelIds ?? []), ...reelIds])];
		await ctx.db.patch(doc._id, { attachedReelIds: merged, updatedAt: Date.now() });
	}
});

export const deleteChat = mutation({
	args: { secret: v.string(), sessionId: v.string() },
	handler: async (ctx, { secret, sessionId }) => {
		assertOwner(secret);
		const doc = await bySession(ctx, sessionId);
		if (doc) await ctx.db.delete(doc._id); // idempotent
	}
});
