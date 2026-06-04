import { error } from '@sveltejs/kit';
import { getTrip } from '$lib/server/services/trips.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const trip = await getTrip(params.slug);
	if (!trip) throw error(404, `Trip "${params.slug}" not found`);
	return { trip, slug: params.slug };
};
