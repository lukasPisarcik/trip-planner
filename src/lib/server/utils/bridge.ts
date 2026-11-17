import { createHash, timingSafeEqual } from 'node:crypto';

// Pure decision logic for the Expo bridge (bearer auth + CORS). The Expo app calls
// /api/ai/chat and /api/bridge/* over plain HTTP with `Authorization: Bearer
// <BRIDGE_SECRET>`, from another origin. Kept free of SvelteKit / env / logger imports
// so it runs under plain `bun test`; the hook and the routes feed it the env values.
// Temporary: deleted with the bridge in milestone 3 of the Expo port.

/** Outcome of checking an `Authorization` header against the bridge secret. */
export type BearerStatus = 'valid' | 'invalid' | 'absent';

/** Methods and request headers a bridge call uses; echoed on the preflight answer. */
export const BRIDGE_ALLOWED_METHODS = 'POST, OPTIONS';
export const BRIDGE_ALLOWED_HEADERS = 'authorization, content-type, accept';
const PREFLIGHT_MAX_AGE_SECONDS = '600';

/** Normalize an origin for comparison: trimmed, lower-cased, no trailing slash. */
function normalizeOrigin(origin: string): string {
	return origin.trim().toLowerCase().replace(/\/+$/, '');
}

/** Parse the comma-separated BRIDGE_ALLOWED_ORIGINS value into a clean list. */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
	if (!raw) return [];
	return raw
		.split(',')
		.map(normalizeOrigin)
		.filter((o) => o.length > 0);
}

/** True for the routes the Expo bridge client calls. */
export function isBridgeOnlyPath(pathname: string): boolean {
	return pathname.startsWith('/api/bridge/');
}

/** The co-pilot stream: reachable by the session cookie OR the bridge bearer. */
export function isBridgeChatPath(pathname: string): boolean {
	return pathname === '/api/ai/chat';
}

/** Constant-time string equality (digests are compared, so lengths never leak). */
export function constantTimeEqual(a: string, b: string): boolean {
	const da = createHash('sha256').update(a).digest();
	const db = createHash('sha256').update(b).digest();
	return timingSafeEqual(da, db);
}

/**
 * Classify an `Authorization` header. `absent` means no bearer was presented at all
 * (the caller may still authenticate another way); `invalid` means one was presented
 * and is wrong — including every bearer while the bridge is disabled (secret unset).
 */
export function bearerStatus(
	authorization: string | null | undefined,
	secret: string | undefined
): BearerStatus {
	if (!authorization) return 'absent';
	const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
	if (!match) return 'invalid';
	if (!secret) return 'invalid';
	return constantTimeEqual(match[1], secret) ? 'valid' : 'invalid';
}

/** True when `origin` is on the allow-list (exact match after normalization). */
export function isOriginAllowed(
	origin: string | null | undefined,
	allowedOrigins: readonly string[]
): boolean {
	if (!origin) return false;
	return allowedOrigins.includes(normalizeOrigin(origin));
}

/**
 * CORS response headers for an allowed origin, or an empty object otherwise — an
 * unlisted origin never sees an `Access-Control-*` header. No credentials are
 * allowed: the bridge authenticates by bearer, never by cross-site cookie.
 */
export function corsHeaders(
	origin: string | null | undefined,
	allowedOrigins: readonly string[]
): Record<string, string> {
	if (!origin || !isOriginAllowed(origin, allowedOrigins)) return {};
	return { 'access-control-allow-origin': origin, vary: 'Origin' };
}

export interface BridgeRequestInfo {
	method: string;
	pathname: string;
	origin: string | null | undefined;
	authorization: string | null | undefined;
	/** BRIDGE_SECRET; unset disables the bearer path. */
	secret: string | undefined;
	allowedOrigins: readonly string[];
}

export type BridgeDecision =
	/** Not a bridge route — the hook's normal logic applies untouched. */
	| { action: 'ignore' }
	/** Answer the CORS preflight directly (204 allowed origin, 403 otherwise). */
	| { action: 'preflight'; status: 204 | 403; headers: Record<string, string> }
	/** Valid bearer — skip the site gate; add `cors` to the response. */
	| { action: 'allow'; cors: Record<string, string> }
	/** Missing/wrong bearer on a bearer-only route, or a wrong bearer on chat — 401. */
	| { action: 'unauthorized'; cors: Record<string, string> }
	/** Chat without a bearer — fall through to the existing session-cookie gate. */
	| { action: 'session' };

/** Decide how the server hook treats a request, from plain values only. */
export function decideBridgeRequest(req: BridgeRequestInfo): BridgeDecision {
	const bridgeOnly = isBridgeOnlyPath(req.pathname);
	const chat = isBridgeChatPath(req.pathname);
	if (!bridgeOnly && !chat) return { action: 'ignore' };

	const cors = corsHeaders(req.origin, req.allowedOrigins);

	if (req.method.toUpperCase() === 'OPTIONS') {
		if (!isOriginAllowed(req.origin, req.allowedOrigins)) {
			return { action: 'preflight', status: 403, headers: {} };
		}
		return {
			action: 'preflight',
			status: 204,
			headers: {
				...cors,
				'access-control-allow-methods': BRIDGE_ALLOWED_METHODS,
				'access-control-allow-headers': BRIDGE_ALLOWED_HEADERS,
				'access-control-max-age': PREFLIGHT_MAX_AGE_SECONDS
			}
		};
	}

	const status = bearerStatus(req.authorization, req.secret);
	if (status === 'valid') return { action: 'allow', cors };
	if (bridgeOnly || status === 'invalid') return { action: 'unauthorized', cors };
	return { action: 'session' };
}

/**
 * Add the owner's `userId` to the args of a secret-gated Convex write, when
 * configured. Returns `args` itself (same reference, so the request is byte-identical
 * to before) unless `ownerUserId` is set AND the call carries the write `secret`.
 */
export function withOwnerUserId<A>(args: A, ownerUserId: string | undefined): A {
	if (!ownerUserId || typeof args !== 'object' || args === null || !('secret' in args)) {
		return args;
	}
	return { ...args, userId: ownerUserId };
}
