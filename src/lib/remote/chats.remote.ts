import { z } from 'zod';
import { command, query } from '$app/server';
import { EmptyInput } from '$lib/schemas';
import * as chatsService from '$lib/server/services/chats.service';

const TripSlugInput = z.object({ tripSlug: z.string().nullable() });
const SessionIdInput = z.object({ sessionId: z.string().min(1) });

export const getChatForTrip = query(TripSlugInput, async ({ tripSlug }) => {
	return chatsService.getChatForTrip(tripSlug);
});

export const listChats = query(EmptyInput, async () => {
	return chatsService.listAllChats();
});

export const getChatBySession = query(SessionIdInput, async ({ sessionId }) => {
	return chatsService.getChatBySession(sessionId);
});

export const deleteChat = command(SessionIdInput, async ({ sessionId }) => {
	await chatsService.deleteChat(sessionId);
	return { ok: true } as const;
});
