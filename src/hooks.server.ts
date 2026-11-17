import type { Handle, HandleServerError } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { log } from '$lib';
import { isSiteGated, PrivateEnvValue } from '$lib/server/env.server';
import { decideBridgeRequest } from '$lib/server/utils/bridge';
import { SESSION_COOKIE, verifySessionToken } from '$lib/server/utils/crypto';

// Paths the site gate never blocks: the login page itself, SvelteKit's build
// assets and service files, and favicons. The MCP bridge and the Expo bridge are
// handled separately in the hook — each bypasses the gate ONLY on its own bearer.
function isAllowListed(pathname: string): boolean {
	if (pathname === '/login') return true;
	if (pathname.startsWith('/_app/') && !pathname.startsWith('/_app/remote/')) return true;
	if (pathname === '/favicon.ico' || pathname.startsWith('/favicon')) return true;
	return false;
}

/**
 * Shared-password site gate. Armed only when SITE_PASSWORD is set: every page
 * load redirects to /login and every /api/* + /_app/remote/* request gets a 401
 * until the signed session cookie (minted by the /login action) is present.
 * With SITE_PASSWORD unset this hook is a pass-through — zero behavior change.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;

	// Expo bridge (temporary — removed in milestone 3 of the Expo port). The Expo
	// app calls /api/ai/chat and /api/bridge/* from another origin with
	// `Authorization: Bearer <BRIDGE_SECRET>`. Like the MCP bridge below, these
	// routes skip the site gate ONLY on their own valid bearer; this runs before
	// the gate check so the bearer is enforced even with SITE_PASSWORD unset. The
	// decision itself is pure (src/lib/server/utils/bridge.ts). VIEWER_MODE is
	// untouched: the routes and the service layer still refuse writes.
	const bridge = decideBridgeRequest({
		method: event.request.method,
		pathname,
		origin: event.request.headers.get('origin'),
		authorization: event.request.headers.get('authorization'),
		secret: PrivateEnvValue('BRIDGE_SECRET'),
		allowedOrigins: PrivateEnvValue('BRIDGE_ALLOWED_ORIGINS')
	});
	if (bridge.action === 'preflight') {
		return new Response(null, { status: bridge.status, headers: bridge.headers });
	}
	if (bridge.action === 'unauthorized') {
		return json({ message: 'Unauthorized' }, { status: 401, headers: bridge.cors });
	}
	if (bridge.action === 'allow') {
		const response = await resolve(event);
		for (const [name, value] of Object.entries(bridge.cors)) response.headers.set(name, value);
		return response;
	}
	// 'ignore' (any other route) and 'session' (chat without a bearer) fall through
	// to the existing behaviour below, unchanged.

	if (!isSiteGated()) return resolve(event);

	if (isAllowListed(pathname)) return resolve(event);

	// The in-app MCP bridge must stay reachable by the local Codex subprocess —
	// but only when it enforces its own bearer secret. With MCP_BRIDGE_SECRET
	// unset the route would fail open, handing anonymous visitors the trip-write
	// tools — so in that case the gate applies like everywhere else.
	if (pathname === '/api/mcp/trip-planner' && PrivateEnvValue('MCP_BRIDGE_SECRET')) {
		return resolve(event);
	}

	const password = PrivateEnvValue('SITE_PASSWORD')!;
	const token = event.cookies.get(SESSION_COOKIE);
	if (await verifySessionToken(token, password)) return resolve(event);

	// Machine callers get a clean 401; pages bounce to the login form. Remote
	// functions are detected via isRemoteRequest — their transport rewrites
	// event.url to the CALLING page's URL, so a path check never matches.
	if (
		event.isRemoteRequest ||
		pathname.startsWith('/api/') ||
		pathname.startsWith('/_app/remote/')
	) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}
	redirect(303, `/login?next=${encodeURIComponent(pathname + search)}`);
};

/**
 * Server-side error handler for unexpected errors.
 *
 * This hook catches errors that bypass the normal error handling flow
 * (e.g., unhandled exceptions, runtime crashes). Errors thrown via
 * createHttpError() already have proper IDs and logging.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();

	const errorDetails = {
		errorId,
		status,
		message,
		url: event.url.pathname,
		method: event.request.method
	};

	if (error instanceof Error) {
		log.error({ ...errorDetails, stack: error.stack, name: error.name }, error.message);
	} else {
		log.error(errorDetails, 'Unexpected server error');
	}

	return {
		message: status >= 500 ? 'An unexpected error occurred' : message,
		code: 'UNEXPECTED_ERROR',
		id: errorId
	};
};
