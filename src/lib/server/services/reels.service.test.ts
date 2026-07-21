import { afterEach, describe, expect, test } from 'bun:test';
import type { Reel } from '$lib/schemas';
import { hydrateReels, saveReel, type ConvexLike, type ReelServiceDeps } from './reels.service';

const TIKTOK = 'https://www.tiktok.com/@chef/video/123';

const realFetch = global.fetch;
afterEach(() => {
	global.fetch = realFetch;
});

/** A fake Convex client that records every query/mutation call, newest last. */
function recordingConvex(
	responses: {
		query?: (args: Record<string, unknown>) => unknown;
		mutation?: (args: Record<string, unknown>) => unknown;
	} = {}
) {
	const calls: { kind: 'query' | 'mutation'; args: Record<string, unknown> }[] = [];
	const client: ConvexLike = {
		async query(_ref, args) {
			calls.push({ kind: 'query', args });
			return responses.query?.(args) ?? null;
		},
		async mutation(_ref, args) {
			calls.push({ kind: 'mutation', args });
			return responses.mutation?.(args) ?? undefined;
		}
	};
	return { client, calls };
}

/** Build a deps object with sensible no-op defaults, overridable per test. */
function fakeDeps(client: ConvexLike, over: Partial<ReelServiceDeps> = {}): ReelServiceDeps {
	return {
		convex: () => client,
		ownerSecret: () => 'test-secret',
		assertWritable: () => {},
		env: () => undefined,
		analyzeReelVisuals: async () => null,
		fetch: (async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch,
		logError: () => {},
		...over
	};
}

/** Poll until `predicate()` is true or the budget runs out (for fire-and-forget work). */
async function waitFor(predicate: () => boolean, budgetMs = 500): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > budgetMs) throw new Error('waitFor: timed out');
		await new Promise((r) => setTimeout(r, 5));
	}
}

describe('saveReel', () => {
	test('inserts a processing row and returns before extraction completes', async () => {
		// Keep global fetch from hitting the network during extractSocialPost.
		global.fetch = (async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch;

		// Block the vision pass so extraction cannot finish until we release it.
		let releaseVisual!: () => void;
		const visualDone = new Promise<void>((res) => (releaseVisual = res));

		const { client, calls } = recordingConvex();
		const deps = fakeDeps(client, {
			analyzeReelVisuals: async () => {
				await visualDone;
				return { onScreenText: 'Signage', visualDescription: 'A khinkali plate' };
			}
		});

		const id = await saveReel(TIKTOK, null, deps);

		// Returned a valid slug id for the detected platform.
		expect(id).toMatch(/^tiktok-[a-z0-9]+$/);

		// The processing row was inserted...
		const saved = calls.filter((c) => c.kind === 'mutation' && 'reel' in c.args);
		expect(saved).toHaveLength(1);
		expect((saved[0].args.reel as Reel).status).toBe('processing');
		expect((saved[0].args.reel as Reel).id).toBe(id);
		expect(saved[0].args.secret).toBe('test-secret');

		// ...but extraction has NOT written yet (it's still blocked on the vision pass).
		expect(calls.some((c) => c.kind === 'mutation' && 'fields' in c.args)).toBe(false);

		// Release the vision pass; the fire-and-forget job now merges results as `ready`.
		releaseVisual();
		await waitFor(() => calls.some((c) => c.kind === 'mutation' && 'fields' in c.args));
		const set = calls.find((c) => c.kind === 'mutation' && 'fields' in c.args)!;
		expect(set.args.id).toBe(id);
		expect((set.args.fields as Partial<Reel>).status).toBe('ready');
		expect((set.args.fields as Partial<Reel>).visualDescription).toBe('A khinkali plate');
	});

	test('rejects an unsupported URL without writing', async () => {
		const { client, calls } = recordingConvex();
		await expect(saveReel('https://youtube.com/watch?v=1', null, fakeDeps(client))).rejects.toThrow(
			/Unsupported reel URL/
		);
		expect(calls).toHaveLength(0);
	});

	test('refuses to write when the writable gate throws (viewer mode)', async () => {
		const { client, calls } = recordingConvex();
		const deps = fakeDeps(client, {
			assertWritable: () => {
				throw new Error('This deployment is read-only');
			}
		});
		await expect(saveReel(TIKTOK, null, deps)).rejects.toThrow(/read-only/);
		expect(calls).toHaveLength(0);
	});
});

describe('hydrateReels', () => {
	const reel = (id: string): Reel => ({
		id,
		platform: 'tiktok',
		sourceUrl: `https://www.tiktok.com/@x/video/${id}`,
		status: 'ready'
	});

	test('maps ids to reels, drops unknowns, and preserves order', async () => {
		const known: Record<string, Reel> = {
			'tiktok-a': reel('tiktok-a'),
			'tiktok-c': reel('tiktok-c')
		};
		const { client } = recordingConvex({
			query: (args) => known[args.id as string] ?? null
		});

		const out = await hydrateReels(['tiktok-a', 'tiktok-missing', 'tiktok-c'], fakeDeps(client));

		expect(out.map((r) => r.id)).toEqual(['tiktok-a', 'tiktok-c']);
	});

	test('returns an empty array when nothing resolves', async () => {
		const { client } = recordingConvex({ query: () => null });
		expect(await hydrateReels(['x', 'y'], fakeDeps(client))).toEqual([]);
	});
});
