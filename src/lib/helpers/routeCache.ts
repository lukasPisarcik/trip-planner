// Two-level cache for road-following route paths computed by the Maps JS Routes
// library: a Map for the page's lifetime, backed by `storage` (localStorage in
// the browser) so a repeat visit on the same device spends zero route requests.
// Framework-free so it runs under `bun test` with a fake Storage.

import { RouteCacheIndexSchema, type RouteCacheIndex } from '$lib/schemas';

export type PathPoint = { lat: number; lng: number };

export interface RouteCache {
	/** The cached path for a segment key, or null on a miss. */
	get(key: string): PathPoint[] | null;
	/** Store a computed path (memory + storage). Never throws. */
	set(key: string, path: PathPoint[]): void;
}

/** Bump the suffix whenever the stored shape changes. */
export const ROUTE_CACHE_STORAGE_KEY = 'trip-map-routes:v1';
const DEFAULT_CAP = 120;

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/**
 * Memory-first, then `storage`. The index keeps insertion order and evicts the
 * oldest entries beyond `cap` (default 120) from both levels. Any storage error
 * — quota exceeded, private mode, corrupt or foreign JSON — is swallowed: the
 * cache then silently degrades to memory-only. Stored data is untrusted and is
 * validated with RouteCacheIndexSchema before use.
 */
export function createRouteCache(storage?: Storage | null, cap = DEFAULT_CAP): RouteCache {
	const memory = new Map<string, PathPoint[]>();
	let stored: RouteCacheIndex | null = null;

	function load(): RouteCacheIndex {
		if (stored) return stored;
		let parsed: RouteCacheIndex | null = null;
		try {
			const raw = storage?.getItem(ROUTE_CACHE_STORAGE_KEY);
			if (raw) {
				const result = RouteCacheIndexSchema.safeParse(JSON.parse(raw));
				if (result.success) parsed = result.data;
			}
		} catch {
			// Unreadable storage / invalid JSON → start fresh; never throw out of the cache.
		}
		stored = parsed ?? { keys: [], paths: {} };
		return stored;
	}

	function persist(index: RouteCacheIndex) {
		try {
			storage?.setItem(ROUTE_CACHE_STORAGE_KEY, JSON.stringify(index));
		} catch {
			// Quota exceeded / disabled storage — memory still holds the path.
		}
	}

	return {
		get(key) {
			const hit = memory.get(key);
			if (hit) return hit;
			if (!storage) return null;
			const raw = load().paths[key];
			if (!raw) return null;
			const path = raw.map(([lat, lng]) => ({ lat, lng }));
			memory.set(key, path);
			return path;
		},
		set(key, path) {
			memory.set(key, path);
			const index = load();
			if (!(key in index.paths)) index.keys.push(key);
			index.paths[key] = path.map((p) => [round5(p.lat), round5(p.lng)]);
			while (index.keys.length > cap) {
				const oldest = index.keys.shift();
				if (oldest === undefined) break;
				delete index.paths[oldest];
				memory.delete(oldest);
			}
			if (storage) persist(index);
		}
	};
}
