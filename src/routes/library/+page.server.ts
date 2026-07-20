import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isViewerMode } from '$lib/server/env.server';

// The Library is an owner-only surface: its whole purpose (saving reels, building
// trips from them) is write/co-pilot work that viewer mode disables. Acceptance
// criterion: "the /library route is hidden under VIEWER_MODE." Hiding the sidebar
// link isn't enough on its own, so redirect direct navigations away too. Writes are
// independently blocked at the service + Convex layer.
export const load: PageServerLoad = () => {
	if (isViewerMode()) redirect(307, '/');
};
