import type { LayoutServerLoad } from './$types';
import { isViewerMode } from '$lib/server/env.server';
import { detectProviderAvailability } from '$lib/server/ai/licence';

// Surface the read-only deployment flag to every route so the client can hide
// editing affordances (AI co-pilot, create/delete, the brainstorm scratchpad).
// Writes are also blocked server-side in the service layer — this is UX only.
//
// `providerAvailability` reports which AI providers have a local CLI login, so the
// model picker can disable a provider's models when its licence isn't detected.
export const load: LayoutServerLoad = () => {
	return {
		viewerMode: isViewerMode(),
		providerAvailability: detectProviderAvailability()
	};
};
