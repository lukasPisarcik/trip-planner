import type { ChatSession } from './chatSession.svelte';

/**
 * Tracks which chat session (if any) is currently streaming a turn, so surfaces
 * that don't own the {@link ChatSession} instance — notably the sidebar session
 * list — can show a live "Working…" indicator. A single id is enough: only one
 * turn streams at a time in practice, and `stop(id)` is id-guarded so a settling
 * turn never clears a newer one.
 */
class ChatActivityStoreClass {
	streamingSessionId = $state<string | null>(null);

	/**
	 * The {@link ChatSession} driving the active turn. Lets a surface that didn't
	 * start the turn (the agent workspace opened mid-run from the panel/sidebar)
	 * render its live items, tools, and streaming status instead of a static
	 * snapshot. Consumers gate on `streaming` + matching `lastSessionId`, so a
	 * lingering reference to a settled session is harmless.
	 */
	activeSession = $state<ChatSession | null>(null);

	/**
	 * Monotonic counter bumped whenever the set of chats changes (a session is
	 * created or a turn persists new messages). Chat lists are read through the
	 * non-reactive `listChats` remote query, so surfaces (sidebar, command palette,
	 * AI panel) watch this in an `$effect` and call `.refresh()` to stay live
	 * without a page reload. Chats stay server-mediated for privacy, so this is the
	 * reactivity bridge instead of a public Convex subscription.
	 */
	version = $state(0);

	start(id: string | null | undefined): void {
		if (id) this.streamingSessionId = id;
	}

	stop(id: string | null | undefined): void {
		if (!id || this.streamingSessionId === id) this.streamingSessionId = null;
	}

	isStreaming(id: string | null | undefined): boolean {
		return !!id && this.streamingSessionId === id;
	}

	/** Mark the session driving the current turn (replaces any prior one). */
	register(session: ChatSession): void {
		this.activeSession = session;
	}

	/** Signal that the chat set changed so chat lists refresh. */
	bump(): void {
		this.version++;
	}
}

export const chatActivityStore = new ChatActivityStoreClass();
