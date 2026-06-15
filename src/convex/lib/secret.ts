/**
 * Owner-write gate.
 *
 * Every mutation that changes data calls `assertOwner(secret)` with the secret
 * supplied by the trusted SvelteKit server (which reads `OWNER_WRITE_SECRET` via
 * `env.server.ts`). The browser never holds this secret, and the public
 * read-only deployment is deliberately NOT given it — so the public site cannot
 * write even though the Convex URL is exposed to the browser for reactive reads.
 *
 * `process.env.OWNER_WRITE_SECRET` is the deployment env var, set with
 * `bunx convex env set OWNER_WRITE_SECRET <value>` (Convex functions read their
 * own deployment env via `process.env`, outside the SvelteKit `env.server.ts` scope).
 */
export function assertOwner(secret: string): void {
	const expected = process.env.OWNER_WRITE_SECRET;
	if (!expected) {
		throw new Error('OWNER_WRITE_SECRET is not configured on this deployment (read-only).');
	}
	if (secret !== expected) {
		throw new Error('Forbidden: this deployment is read-only.');
	}
}
