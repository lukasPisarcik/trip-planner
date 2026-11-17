import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { formatZodErrors, log } from '$lib';
import {
	BridgeSaveReelRequestSchema,
	type BridgeErrorResponse,
	type BridgeSaveReelResponse
} from '$lib/schemas';
import { isViewerMode, PrivateEnvValue } from '$lib/server/env.server';
import * as reelsService from '$lib/server/services/reels.service';
import { detectPlatform } from '$lib/server/services/social.service';
import { bearerStatus } from '$lib/server/utils/bridge';

// Expo bridge (temporary — removed in milestone 3 of the Expo port): the plain-HTTP
// twin of the `saveReel` command, for the Expo app. Bearer-only. The server hook
// already rejects a missing/wrong bearer and adds CORS headers for allowed origins;
// the check here is defence in depth.

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
	const parsed = BridgeSaveReelRequestSchema.safeParse(raw);
	if (!parsed.success) {
		return fail(400, {
			message: 'Invalid request body',
			code: 'VALIDATION_ERROR',
			errors: formatZodErrors(parsed.error)
		});
	}
	const { url, folderId } = parsed.data;
	if (!detectPlatform(url)) {
		return fail(400, {
			message: 'Unsupported reel URL (not TikTok or Instagram)',
			code: 'UNSUPPORTED_URL'
		});
	}

	try {
		// Inserts a `processing` row and starts extraction in the background; the
		// client watches the reel's status through its live Convex query.
		const id = await reelsService.saveReel(url, folderId ?? null);
		const body: BridgeSaveReelResponse = { id };
		return json(body, { status: 201 });
	} catch (e) {
		const errorId = crypto.randomUUID();
		log.error(
			{ errorId, err: e instanceof Error ? e.message : String(e) },
			'Bridge: save reel failed'
		);
		return fail(500, { message: 'Failed to save the reel', code: 'INTERNAL_ERROR', errorId });
	}
};
