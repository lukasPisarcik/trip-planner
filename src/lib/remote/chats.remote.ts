import { z } from 'zod';
import { query } from '$app/server';
import * as chatsService from '$lib/server/services/chats.service';

const TripSlugInput = z.object({ tripSlug: z.string().nullable() });

export const getChatForTrip = query(TripSlugInput, async ({ tripSlug }) => {
	return chatsService.getChatForTrip(tripSlug);
});
