import { z } from 'zod';
import { command } from '$app/server';
import { TripSchema, TripHeadlinePatchSchema, MoveTripToFolderInput } from '$lib/schemas';
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

const SetTripFavoriteInput = z.object({
	slug: z.string().min(1),
	favorite: z.boolean()
});

// Reads are served reactively to the client via convex-svelte `useQuery`
// (api.trips.*); the server still reads through the service for SSR / the AI agent.
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

export const setTripFavorite = command(SetTripFavoriteInput, async ({ slug, favorite }) => {
	await tripsService.setTripFavorite(slug, favorite);
	return { ok: true } as const;
});

export const moveTripToFolder = command(MoveTripToFolderInput, async ({ slug, folderId }) => {
	await tripsService.moveTripToFolder(slug, folderId);
	return { ok: true } as const;
});
