import { describe, expect, test } from 'bun:test';
import { createRouteCache, ROUTE_CACHE_STORAGE_KEY, type PathPoint } from './routeCache';

/** A Map-backed stand-in for localStorage. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(seed));
	return {
		get length() {
			return map.size;
		},
		key: (i: number) => [...map.keys()][i] ?? null,
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, String(v)),
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear()
	} as Storage;
}

const path = (seed: number): PathPoint[] => [
	{ lat: 52.5 + seed, lng: 13.4 },
	{ lat: 52.6 + seed, lng: 13.5 }
];

describe('createRouteCache', () => {
	test('memory hit without any storage', () => {
		const cache = createRouteCache(null);
		expect(cache.get('a')).toBeNull();
		cache.set('a', path(0));
		expect(cache.get('a')).toEqual(path(0));
	});

	test('round-trips through storage so a fresh instance hits', () => {
		const storage = fakeStorage();
		createRouteCache(storage).set('seg', path(1));

		const raw = storage.getItem(ROUTE_CACHE_STORAGE_KEY);
		expect(raw).not.toBeNull();
		// Stored as compact 5-decimal pairs, not {lat,lng} objects.
		expect(JSON.parse(raw!).paths.seg).toEqual([
			[53.5, 13.4],
			[53.6, 13.5]
		]);

		const again = createRouteCache(storage);
		expect(again.get('seg')).toEqual(path(1));
		expect(again.get('missing')).toBeNull();
	});

	test('rounds stored coordinates to 5 decimals', () => {
		const storage = fakeStorage();
		createRouteCache(storage).set('r', [{ lat: 1.123456789, lng: -2.987654321 }]);
		expect(createRouteCache(storage).get('r')).toEqual([{ lat: 1.12346, lng: -2.98765 }]);
	});

	test('evicts the oldest entries beyond the cap, keeping the newest', () => {
		const storage = fakeStorage();
		const cache = createRouteCache(storage, 3);
		cache.set('k1', path(1));
		cache.set('k2', path(2));
		cache.set('k3', path(3));
		cache.set('k4', path(4));

		expect(cache.get('k1')).toBeNull(); // evicted from memory too
		expect(cache.get('k2')).toEqual(path(2));
		expect(cache.get('k4')).toEqual(path(4));

		const stored = JSON.parse(storage.getItem(ROUTE_CACHE_STORAGE_KEY)!);
		expect(stored.keys).toEqual(['k2', 'k3', 'k4']);
		expect(Object.keys(stored.paths).sort()).toEqual(['k2', 'k3', 'k4']);
	});

	test('re-setting an existing key does not grow the index', () => {
		const storage = fakeStorage();
		const cache = createRouteCache(storage, 2);
		cache.set('a', path(1));
		cache.set('a', path(2));
		cache.set('b', path(3));
		expect(cache.get('a')).toEqual(path(2));
		expect(cache.get('b')).toEqual(path(3));
		expect(JSON.parse(storage.getItem(ROUTE_CACHE_STORAGE_KEY)!).keys).toEqual(['a', 'b']);
	});

	test('a throwing storage never throws out and still serves memory', () => {
		const broken = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new DOMException('QuotaExceededError');
			}
		} as unknown as Storage;
		const cache = createRouteCache(broken);
		expect(() => cache.set('x', path(0))).not.toThrow();
		expect(cache.get('x')).toEqual(path(0));
		expect(cache.get('y')).toBeNull();
	});

	test('corrupt stored JSON is treated as empty', () => {
		const storage = fakeStorage({ [ROUTE_CACHE_STORAGE_KEY]: '{not json' });
		const cache = createRouteCache(storage);
		expect(cache.get('a')).toBeNull();
		cache.set('a', path(0));
		expect(createRouteCache(storage).get('a')).toEqual(path(0));
	});

	test('a malformed stored entry never throws — the index is discarded', () => {
		// Valid JSON, wrong shape (a hand-edited / extension-written value).
		const storage = fakeStorage({
			[ROUTE_CACHE_STORAGE_KEY]: JSON.stringify({ keys: ['k'], paths: { k: [1, 2] } })
		});
		const cache = createRouteCache(storage);
		expect(() => cache.get('k')).not.toThrow();
		expect(cache.get('k')).toBeNull();
		cache.set('k', path(0));
		expect(createRouteCache(storage).get('k')).toEqual(path(0));
	});
});
