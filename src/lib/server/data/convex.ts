import { ConvexHttpClient } from 'convex/browser';
import { PrivateEnvValue } from '../env.server';

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
	if (!client) client = new ConvexHttpClient(PrivateEnvValue('CONVEX_URL'));
	return client;
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
