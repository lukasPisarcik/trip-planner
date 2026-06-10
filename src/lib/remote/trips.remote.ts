import { z } from 'zod';
import { command, query } from '$app/server';
import { EmptyInput, TripSchema, TripHeadlinePatchSchema } from '$lib/schemas';
import * as tripsService from '$lib/server/services/trips.service';

const SlugInput = z.object({ slug: z.string().min(1) });

const UpdateTripFieldsInput = z.object({
	slug: z.string().min(1),
	fields: TripHeadlinePatchSchema
});

const SaveBrainstormInput = z.object({
	slug: z.string().min(1),
	content: z.string()
});

export const listTrips = query(EmptyInput, async () => {
	return tripsService.listTrips();
});

export const getTrip = query(SlugInput, async ({ slug }) => {
	return tripsService.getTrip(slug);
});

export const createTrip = command(TripSchema, async (input) => {
	return tripsService.createTrip(input);
});

export const updateTripFields = command(UpdateTripFieldsInput, async ({ slug, fields }) => {
	await tripsService.updateTripFields(slug, fields);
	return { ok: true } as const;
});

export const deleteTrip = command(SlugInput, async ({ slug }) => {
	await tripsService.deleteTrip(slug);
	return { ok: true } as const;
});

export const saveBrainstorm = command(SaveBrainstormInput, async ({ slug, content }) => {
	await tripsService.replaceTripTab(slug, 'brainstorm', content);
	return { ok: true } as const;
});
