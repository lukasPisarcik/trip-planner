import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isSiteGated, PrivateEnvValue } from '$lib/server/env.server';
import {
	mintSessionToken,
	passwordsMatch,
	SESSION_COOKIE,
	verifySessionToken
} from '$lib/server/utils/crypto';

const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/** Only same-origin paths — never an absolute URL an attacker could plant.
 * Rejects `//host` and `/\host` (browsers normalize `\` to `/` in Location). */
function sanitizeNext(next: string | null): string {
	if (!next || !/^\/(?![/\\])/.test(next)) return '/';
	return next;
}

export const load: PageServerLoad = async ({ cookies, url }) => {
	// Gate off, or already signed in → nothing to do here.
	if (!isSiteGated()) redirect(303, '/');
	const password = PrivateEnvValue('SITE_PASSWORD')!;
	if (await verifySessionToken(cookies.get(SESSION_COOKIE), password)) {
		redirect(303, sanitizeNext(url.searchParams.get('next')));
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (!isSiteGated()) redirect(303, '/');

		const form = await request.formData();
		const submitted = form.get('password');
		const configured = PrivateEnvValue('SITE_PASSWORD')!;

		if (typeof submitted !== 'string' || !(await passwordsMatch(submitted, configured))) {
			// Flat delay on failure — cheap brake on online dictionary attacks
			// against a human-memorable shared password.
			await new Promise((r) => setTimeout(r, 500));
			return fail(400, { error: 'Wrong password — try again.' });
		}

		cookies.set(SESSION_COOKIE, await mintSessionToken(configured), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: SESSION_MAX_AGE_S
		});
		redirect(303, sanitizeNext(url.searchParams.get('next')));
	}
};
