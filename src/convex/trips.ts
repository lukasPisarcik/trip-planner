import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import {
	TripSchema,
	TripHeadlinePatchSchema,
	ItineraryTabSchema,
	TransportTabSchema,
	ViralTabSchema,
	FlightsTabSchema,
	BudgetTabSchema,
	TipsTabSchema,
	RestaurantsTabSchema,
	BrainstormSchema
} from '../lib/schemas/schemas';
import { assertOwner } from './lib/secret';

// Per-tab schema map, mirroring `replaceTripTab` in the old service. The full
// trip body is validated by `TripSchema` (in schemas.ts — the single source of
// truth); here we validate the single tab being replaced.
const TAB_SCHEMAS = {
	itinerary: ItineraryTabSchema,
	transport: TransportTabSchema,
	viral: ViralTabSchema,
	flights: FlightsTabSchema,
	budget: BudgetTabSchema,
	tips: TipsTabSchema,
	restaurants: RestaurantsTabSchema,
	brainstorm: BrainstormSchema
} as const;
type TabKey = keyof typeof TAB_SCHEMAS;

async function requireTrip(ctx: MutationCtx, slug: string) {
	const doc = await ctx.db
		.query('trips')
		.withIndex('by_slug', (q) => q.eq('slug', slug))
		.unique();
	if (!doc) throw new Error(`Trip "${slug}" not found`);
	return doc;
}

// ---- Reads (public, reactive) ----

export const listTrips = query({
	args: {},
	handler: async (ctx) => {
		const docs = await ctx.db.query('trips').collect();
		return docs.sort((a, b) => a.createdAt - b.createdAt).map((d) => d.data);
	}
});

export const getTrip = query({
	args: { slug: v.string() },
	handler: async (ctx, { slug }) => {
		const doc = await ctx.db
			.query('trips')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		return doc ? doc.data : null;
	}
});

// ---- Writes (secret-gated) ----

export const createTrip = mutation({
	args: { secret: v.string(), trip: v.any() },
	handler: async (ctx, { secret, trip }) => {
		assertOwner(secret);
		const parsed = TripSchema.parse(trip);
		const existing = await ctx.db
			.query('trips')
			.withIndex('by_slug', (q) => q.eq('slug', parsed.slug))
			.unique();
		if (existing) throw new Error(`Trip with slug "${parsed.slug}" already exists`);
		const now = Date.now();
		await ctx.db.insert('trips', {
			slug: parsed.slug,
			folderId: parsed.folderId ?? null,
			data: parsed,
			createdAt: now,
			updatedAt: now
		});
		return parsed.slug;
	}
});

export const updateTripFields = mutation({
	args: { secret: v.string(), slug: v.string(), fields: v.any() },
	handler: async (ctx, { secret, slug, fields }) => {
		assertOwner(secret);
		const parsed = TripHeadlinePatchSchema.parse(fields);
		const doc = await requireTrip(ctx, slug);
		await ctx.db.patch(doc._id, { data: { ...doc.data, ...parsed }, updatedAt: Date.now() });
	}
});

export const replaceTripTab = mutation({
	args: { secret: v.string(), slug: v.string(), tab: v.string(), payload: v.any() },
	handler: async (ctx, { secret, slug, tab, payload }) => {
		assertOwner(secret);
		const schema = TAB_SCHEMAS[tab as TabKey];
		if (!schema) throw new Error(`Unknown trip tab "${tab}"`);
		const parsed = schema.parse(payload);
		const doc = await requireTrip(ctx, slug);
		await ctx.db.patch(doc._id, { data: { ...doc.data, [tab]: parsed }, updatedAt: Date.now() });
	}
});

export const setTripFavorite = mutation({
	args: { secret: v.string(), slug: v.string(), favorite: v.boolean() },
	handler: async (ctx, { secret, slug, favorite }) => {
		assertOwner(secret);
		const doc = await requireTrip(ctx, slug);
		await ctx.db.patch(doc._id, { data: { ...doc.data, favorite }, updatedAt: Date.now() });
	}
});

export const moveTripToFolder = mutation({
	args: { secret: v.string(), slug: v.string(), folderId: v.union(v.string(), v.null()) },
	handler: async (ctx, { secret, slug, folderId }) => {
		assertOwner(secret);
		const doc = await requireTrip(ctx, slug);
		// Keep the indexed column and the body in sync.
		await ctx.db.patch(doc._id, {
			folderId,
			data: { ...doc.data, folderId },
			updatedAt: Date.now()
		});
	}
});

export const deleteTrip = mutation({
	args: { secret: v.string(), slug: v.string() },
	handler: async (ctx, { secret, slug }) => {
		assertOwner(secret);
		const doc = await ctx.db
			.query('trips')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		if (doc) await ctx.db.delete(doc._id);
	}
});
