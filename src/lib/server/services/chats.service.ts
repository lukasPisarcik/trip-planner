import { log } from '$lib';
import { type ChatMessage } from '$lib/schemas';
import { createFileStore } from '../data/store';
import { isViewerMode } from '../env.server';

export interface ChatRecord {
	sessionId: string;
	tripSlug: string | null;
	messages: ChatMessage[];
	createdAt: number;
	updatedAt: number;
}

const chatsStore = createFileStore<ChatRecord[]>('chats.json', () => []);

function latestNonEmptyForTripSlug(
	records: ChatRecord[],
	tripSlug: string | null
): ChatRecord | null {
	return (
		[...records]
			.filter((r) => r.tripSlug === tripSlug && r.messages.length > 0)
			.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
	);
}

export async function getChatForTrip(tripSlug: string | null): Promise<ChatRecord | null> {
	// Read-only deployments have no chat history and can't touch the Bun-backed
	// file-store (unavailable on Vercel's Node runtime). Short-circuit before any
	// store access so the panel — which isn't rendered there anyway — stays inert.
	if (isViewerMode()) return null;
	// "New trip" mode (null slug) always starts fresh — never resurrect the shared
	// pool of unlinked null-slug threads (otherwise every new conversation reopens
	// the last one). Real trips still resume their own thread.
	if (tripSlug === null) return null;
	const records = await chatsStore.read();
	// Empty records belong to abandoned starts (or to a turn whose first
	// request failed before any message persisted). Hide them from the
	// client so the panel renders EmptyState instead of resurrecting a
	// dead session id.
	return latestNonEmptyForTripSlug(records, tripSlug);
}

export async function listAllChats(): Promise<ChatRecord[]> {
	// Sidebar "AI sessions" list. Empty records are abandoned starts — hide them,
	// same as getChatForTrip. Most-recently-updated first.
	if (isViewerMode()) return [];
	const records = await chatsStore.read();
	return [...records]
		.filter((r) => r.messages.length > 0)
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getChatBySession(sessionId: string): Promise<ChatRecord | null> {
	if (isViewerMode()) return null;
	const records = await chatsStore.read();
	return records.find((r) => r.sessionId === sessionId) ?? null;
}

export async function getOrCreateChat(tripSlug: string | null): Promise<ChatRecord> {
	const records = await chatsStore.read();
	const existing = latestNonEmptyForTripSlug(records, tripSlug);
	if (existing) return existing;
	return createChat(tripSlug);
}

export async function createChat(tripSlug: string | null): Promise<ChatRecord> {
	const records = await chatsStore.read();
	// Drop stale empty records for this trip before creating a fresh one.
	// Reusing their sessionId would collide with the CLI's session file
	// from a previous failed turn and cause the subprocess to exit 1.
	const filtered = records.filter((r) => r.tripSlug !== tripSlug || r.messages.length > 0);
	const droppedCount = records.length - filtered.length;
	const now = Date.now();
	const chat: ChatRecord = {
		sessionId: crypto.randomUUID(),
		tripSlug,
		messages: [],
		createdAt: now,
		updatedAt: now
	};
	await chatsStore.write([...filtered, chat]);
	log.info(
		{ tripSlug, sessionId: chat.sessionId, droppedStale: droppedCount },
		'Created chat thread'
	);
	return chat;
}

export async function appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
	if (messages.length === 0) return;
	const records = await chatsStore.read();
	const idx = records.findIndex((r) => r.sessionId === sessionId);
	if (idx === -1) throw new Error(`Chat with sessionId "${sessionId}" not found`);
	const next = [...records];
	next[idx] = {
		...next[idx],
		messages: [...next[idx].messages, ...messages],
		updatedAt: Date.now()
	};
	await chatsStore.write(next);
}

export async function deleteChat(sessionId: string): Promise<void> {
	const records = await chatsStore.read();
	const next = records.filter((r) => r.sessionId !== sessionId);
	if (next.length === records.length) return; // nothing to delete — stay idempotent
	await chatsStore.write(next);
	log.info({ sessionId }, 'Deleted chat thread');
}

export async function setTripSlug(sessionId: string, tripSlug: string): Promise<void> {
	const records = await chatsStore.read();
	const idx = records.findIndex((r) => r.sessionId === sessionId);
	if (idx === -1) throw new Error(`Chat with sessionId "${sessionId}" not found`);
	const next = [...records];
	next[idx] = { ...next[idx], tripSlug, updatedAt: Date.now() };
	await chatsStore.write(next);
}
