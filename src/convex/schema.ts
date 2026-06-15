import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Convex storage schema.
 *
 * Validators here are intentionally MINIMAL: the deeply-nested trip/chat bodies
 * are stored as `v.any()` and validated authoritatively with the Zod schemas in
 * `src/lib/schemas/schemas.ts` inside each function handler (the project's single
 * source of truth for schemas). Only the columns we index/query on are typed.
 */
export default defineSchema({
	// One document per trip. `data` is the full Trip object (Zod-validated on write);
	// `slug` and `folderId` are denormalized to the top level so they can be indexed
	// (Convex indexes only reach top-level fields, not into `data`). Kept in sync on write.
	trips: defineTable({
		slug: v.string(),
		folderId: v.union(v.string(), v.null()),
		data: v.any(),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('by_slug', ['slug'])
		.index('by_folder', ['folderId']),

	// Sidebar folders. `id` is the slug business key (Convex's own `_id` is separate).
	folders: defineTable({
		id: v.string(),
		name: v.string(),
		createdAt: v.number()
	}).index('by_slug', ['id']),

	// AI chat threads. `messages` is the append-only thread (fetched whole).
	chats: defineTable({
		sessionId: v.string(),
		tripSlug: v.union(v.string(), v.null()),
		// AI provider that owns this thread + its provider-native session/thread id,
		// for resume. Optional so existing rows (all Claude) keep working — absent
		// `provider` is treated as 'anthropic', whose resume key is `sessionId`.
		provider: v.optional(v.union(v.literal('anthropic'), v.literal('openai'))),
		providerThreadId: v.optional(v.string()),
		messages: v.array(v.any()),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('by_session', ['sessionId'])
		.index('by_trip', ['tripSlug'])
});
