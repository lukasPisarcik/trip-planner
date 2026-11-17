import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { formatZodErrors, log } from '$lib';
import {
	BridgeRetryReelRequestSchema,
	type BridgeErrorResponse,
	type BridgeRetryReelResponse
} from '$lib/schemas';
import { isViewerMode, PrivateEnvValue } from '$lib/server/env.server';
import * as reelsService from '$lib/server/services/reels.service';
import { bearerStatus } from '$lib/server/utils/bridge';

// Expo bridge (temporary — removed in milestone 3 of the Expo port): the plain-HTTP
// twin of the `retryReelExtraction` command, for the Expo app. Bearer-only. The
// server hook already rejects a missing/wrong bearer and adds CORS headers for
// allowed origins; the check here is defence in depth.

function fail(status: number, body: BridgeErrorResponse): Response {
	return json(body, { status });
}

export const POST: RequestHandler = async ({ request }) => {
	if (
		bearerStatus(request.headers.get('authorization'), PrivateEnvValue('BRIDGE_SECRET')) !== 'valid'
	) {
		return fail(401, { message: 'Unauthorized', code: 'UNAUTHORIZED' });
	}
	// Read-only public deployment: never write (the service asserts this too).
	if (isViewerMode()) {
		return fail(403, { message: 'This deployment is read-only', code: 'READ_ONLY' });
	}

	const raw: unknown = await request.json().catch(() => null);
	const parsed = BridgeRetryReelRequestSchema.safeParse(raw);
	if (!parsed.success) {
		return fail(400, {
			message: 'Invalid request body',
			code: 'VALIDATION_ERROR',
			errors: formatZodErrors(parsed.error)
		});
	}
	const { id } = parsed.data;

	try {
		// Look the reel up first so an unknown id is a clean 404 rather than a 500.
		const [reel] = await reelsService.hydrateReels([id]);
		if (!reel) return fail(404, { message: `Reel "${id}" not found`, code: 'NOT_FOUND' });

		// Resets the row to `processing` and re-runs extraction in the background.
		await reelsService.retryReelExtraction(id);
		const body: BridgeRetryReelResponse = { id, status: 'processing' };
		return json(body, { status: 202 });
	} catch (e) {
		const errorId = crypto.randomUUID();
		log.error(
			{ errorId, id, err: e instanceof Error ? e.message : String(e) },
			'Bridge: retry reel extraction failed'
		);
		return fail(500, {
			message: 'Failed to retry the reel extraction',
			code: 'INTERNAL_ERROR',
			errorId
		});
	}
};
