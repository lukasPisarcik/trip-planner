import { ConvexHttpClient } from 'convex/browser';
import { PrivateEnvValue } from '../env.server';
import { withOwnerUserId } from '../utils/bridge';

/**
 * Server-side Convex client.
 *
 * Used by the service layer for point-in-time reads (SSR + the AI agent) and for
 * secret-gated writes. The browser does its own reactive reads via `convex-svelte`
 * (PUBLIC_CONVEX_URL) — this client never reaches the browser, so the write secret
 * stays server-only. No auth is set, so a single module-level instance is safe.
 */
let client: ConvexHttpClient | null = null;

export function convex(): ConvexHttpClient {
	if (!client) {
		client = new ConvexHttpClient(PrivateEnvValue('CONVEX_URL'));
		stampOwnerOnWrites(client);
	}
	return client;
}

/**
 * Owner stamping for the Expo bridge (temporary — removed in milestone 3). While
 * this server and the new Expo app write to the same deployment, rows created here
 * must carry the owner's user id (see `withOwnerUserId`: a no-op, same args object,
 * unless BRIDGE_OWNER_USER_ID is set and the call carries the write secret). Done
 * once, at the client, so every service's secret-gated mutation is covered without
 * touching each call site. Only mutations are stamped; queries are sent as before.
 */
function stampOwnerOnWrites(target: ConvexHttpClient): void {
	// The client's generic signature (args tuple derived from each function
	// reference) can't be forwarded generically, so the wrapper is loosely typed
	// inside and re-asserted to the original signature for every caller.
	type LooseMutation = (ref: unknown, args?: unknown, options?: unknown) => Promise<unknown>;
	const mutate = target.mutation.bind(target) as LooseMutation;
	const stamped: LooseMutation = (ref, args, options) =>
		mutate(ref, withOwnerUserId(args, PrivateEnvValue('BRIDGE_OWNER_USER_ID')), options);
	target.mutation = stamped as typeof target.mutation;
}

/**
 * The owner write-secret attached to every mutation. Absent on the read-only
 * public deployment — callers gate writes with `assertWritable()` (VIEWER_MODE)
 * before reaching here, but throw clearly if a write is somehow attempted without it.
 */
export function ownerSecret(): string {
	const secret = PrivateEnvValue('OWNER_WRITE_SECRET');
	if (!secret) {
		throw new Error('OWNER_WRITE_SECRET is not configured — this deployment is read-only.');
	}
	return secret;
}
