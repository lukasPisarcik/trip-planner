import type { LayoutServerLoad } from './$types';
import { isViewerMode } from '$lib/server/env.server';

// Surface the read-only deployment flag to every route so the client can hide
// editing affordances (AI co-pilot, create/delete, the brainstorm scratchpad).
// Writes are also blocked server-side in the service layer — this is UX only.
export const load: LayoutServerLoad = () => {
	return { viewerMode: isViewerMode() };
};
