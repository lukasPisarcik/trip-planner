import { api } from '$convex/_generated/api';
import { type ChatMessage, type ChatProvider } from '$lib/schemas';
import { convex, ownerSecret } from '../data/convex';
import { isViewerMode } from '../env.server';

export interface ChatRecord {
	sessionId: string;
	tripSlug: string | null;
	/** Provider that owns the thread + its native resume id (absent → legacy Claude thread). */
	provider?: ChatProvider;
	providerThreadId?: string | null;
	messages: ChatMessage[];
	createdAt: number;
	updatedAt: number;
}

export async function getChatForTrip(tripSlug: string | null): Promise<ChatRecord | null> {
	// Read-only deployments have no chat surface — short-circuit before touching Convex
	// (the chat queries are owner-secret-gated and the public deployment has no secret).
	if (isViewerMode()) return null;
	if (tripSlug === null) return null;
	return (await convex().query(api.chats.getChatForTrip, {
		secret: ownerSecret(),
		tripSlug
	})) as ChatRecord | null;
}

export async function listAllChats(): Promise<ChatRecord[]> {
	if (isViewerMode()) return [];
	return (await convex().query(api.chats.listChats, { secret: ownerSecret() })) as ChatRecord[];
}

export async function getChatBySession(sessionId: string): Promise<ChatRecord | null> {
	if (isViewerMode()) return null;
	return (await convex().query(api.chats.getChatBySession, {
		secret: ownerSecret(),
		sessionId
	})) as ChatRecord | null;
}

export async function getOrCreateChat(tripSlug: string | null): Promise<ChatRecord> {
	// The sessionId doubles as the Claude CLI session file name, so the server mints it.
	const sessionId = crypto.randomUUID();
	return (await convex().mutation(api.chats.getOrCreateChat, {
		secret: ownerSecret(),
		tripSlug,
		sessionId
	})) as ChatRecord;
}

export async function createChat(tripSlug: string | null): Promise<ChatRecord> {
	const sessionId = crypto.randomUUID();
	return (await convex().mutation(api.chats.createChat, {
		secret: ownerSecret(),
		tripSlug,
		sessionId
	})) as ChatRecord;
}

export async function appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
	if (messages.length === 0) return;
	await convex().mutation(api.chats.appendMessages, { secret: ownerSecret(), sessionId, messages });
}

export async function deleteChat(sessionId: string): Promise<void> {
	await convex().mutation(api.chats.deleteChat, { secret: ownerSecret(), sessionId });
}

export async function setTripSlug(sessionId: string, tripSlug: string): Promise<void> {
	await convex().mutation(api.chats.setTripSlug, { secret: ownerSecret(), sessionId, tripSlug });
}

export async function setProviderThread(
	sessionId: string,
	provider: ChatProvider,
	providerThreadId: string
): Promise<void> {
	await convex().mutation(api.chats.setProviderThread, {
		secret: ownerSecret(),
		sessionId,
		provider,
		providerThreadId
	});
}
