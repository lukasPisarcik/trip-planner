/**
 * Tracks which chat session (if any) is currently streaming a turn, so surfaces
 * that don't own the {@link ChatSession} instance — notably the sidebar session
 * list — can show a live "Working…" indicator. A single id is enough: only one
 * turn streams at a time in practice, and `stop(id)` is id-guarded so a settling
 * turn never clears a newer one.
 */
class ChatActivityStoreClass {
	streamingSessionId = $state<string | null>(null);

	start(id: string | null | undefined): void {
		if (id) this.streamingSessionId = id;
	}

	stop(id: string | null | undefined): void {
		if (!id || this.streamingSessionId === id) this.streamingSessionId = null;
	}

	isStreaming(id: string | null | undefined): boolean {
		return !!id && this.streamingSessionId === id;
	}
}

export const chatActivityStore = new ChatActivityStoreClass();
