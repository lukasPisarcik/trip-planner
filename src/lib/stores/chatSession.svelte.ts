import type { ChatMessage, ChatModel, AskUserPayload } from '$lib/schemas';
import { formatTool } from '$lib/ai/formatTool';
import { chatActivityStore } from './chatActivityStore.svelte';

// A single renderable item in a conversation. Both persisted history and the
// live streaming turn are projected to this shape so there is exactly one
// rendering path (see Message.svelte). Tool/thinking items carry the live state
// the chip/disclosure needs; persisted messages map to their settled form.
export type TurnItem =
	| { kind: 'user'; id: string; text: string }
	| { kind: 'assistant'; id: string; text: string }
	| { kind: 'error'; id: string; text: string }
	| { kind: 'thinking'; id: string; text: string; active: boolean; durationMs?: number }
	| {
			kind: 'tool';
			id: string;
			name: string;
			icon: string;
			label: string;
			detail?: string;
			status: 'running' | 'done' | 'error';
	  }
	| { kind: 'questions'; id: string; payload: AskUserPayload; answered: boolean };

export type ChatStatus = 'idle' | 'thinking' | 'tool' | 'responding' | 'error';

/** Project persisted chat history into renderable items. */
export function messagesToItems(messages: ChatMessage[]): TurnItem[] {
	return messages.map((m, i): TurnItem => {
		switch (m.role) {
			case 'questions':
				return {
					kind: 'questions',
					id: m.id,
					payload: m.questions ?? { questions: [] },
					// Answered only once the USER replies (their answers are a later `user`
					// message). The agent's own closing line after ask_user is an `assistant`
					// message and must NOT mark the form answered.
					answered: messages.slice(i + 1).some((n) => n.role === 'user')
				};
			case 'thinking':
				return { kind: 'thinking', id: m.id, text: m.content, active: false };
			case 'tool':
				return {
					kind: 'tool',
					id: m.id,
					name: m.toolName ?? '',
					icon: formatTool(m.toolName ?? '', {}).icon,
					label: m.content,
					detail: m.detail,
					status: 'done'
				};
			case 'user':
				return { kind: 'user', id: m.id, text: m.content };
			case 'error':
				return { kind: 'error', id: m.id, text: m.content };
			default:
				return { kind: 'assistant', id: m.id, text: m.content };
		}
	});
}

export interface SendOptions {
	tripSlug: string | null;
	model?: ChatModel;
	/** Session to resume. Falls back to the id learned from the last turn. */
	sessionId?: string | null;
	/** Force a brand-new conversation (explicit "New chat"), bypassing trip-thread resume. */
	forceNew?: boolean;
	/** Run after the turn settles (e.g. refresh persisted history, then reset()). */
	onDone?: () => void | Promise<void>;
}

/**
 * Drives one chat turn over the SSE endpoint. Owns the AbortController (so a
 * stop button / navigation tears down the server agent), parses the event
 * stream, and exposes reactive live state. Instantiate one per surface (side
 * panel, standalone view) — it is not a singleton.
 */
export class ChatSession {
	/** Live items for the in-flight turn (user echo + streaming output). */
	items = $state<TurnItem[]>([]);
	streaming = $state(false);
	status = $state<ChatStatus>('idle');
	/** Contextual line shown instead of bare dots ("Thinking…", "Creating your trip…"). */
	statusLabel = $state('');
	error = $state<{ kind: string } | null>(null);
	authRequired = $state(false);
	/** Server session id for the most recent turn (from the `session` SSE event). */
	lastSessionId = $state<string | null>(null);
	/** Context-window footprint after the latest turn (drives the composer gauge). */
	usage = $state<{ used: number; total: number } | null>(null);
	/** Slug of a trip the agent created this turn, so surfaces can link to it. */
	createdTripSlug = $state<string | null>(null);

	#controller: AbortController | null = null;

	get canSend(): boolean {
		return !this.streaming;
	}

	stop(): void {
		this.#controller?.abort();
	}

	reset(): void {
		this.items = [];
		this.status = 'idle';
		this.statusLabel = '';
		this.error = null;
		this.lastSessionId = null;
		this.usage = null;
		this.createdTripSlug = null;
	}

	async send(text: string, opts: SendOptions): Promise<void> {
		if (this.streaming) return;
		this.error = null;
		this.authRequired = false;
		// A fresh turn supersedes any prior "trip ready" card.
		this.createdTripSlug = null;
		this.items.push({ kind: 'user', id: crypto.randomUUID(), text });
		this.streaming = true;
		this.status = 'thinking';
		this.statusLabel = 'Thinking…';

		const controller = new AbortController();
		this.#controller = controller;

		// Resume the session the caller named, or the one we learned mid-conversation.
		const resumeId = opts.sessionId ?? this.lastSessionId ?? undefined;
		// Light up the sidebar's live "Working…" indicator for a known session id.
		chatActivityStore.start(resumeId);

		let assistantIdx: number | null = null;
		let thinkingIdx: number | null = null;
		let thinkStart = 0;

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					tripSlug: opts.tripSlug,
					message: text,
					model: opts.model,
					sessionId: resumeId,
					newChat: opts.forceNew || undefined
				}),
				signal: controller.signal
			});
			if (!res.ok || !res.body) throw new Error('chat request failed');

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const parts = buffer.split('\n\n');
				buffer = parts.pop() ?? '';
				for (const part of parts) {
					if (!part.startsWith('data:')) continue;
					const payload = part.slice(5).trim();
					if (!payload) continue;
					let ev: Record<string, unknown>;
					try {
						ev = JSON.parse(payload);
					} catch {
						continue;
					}

					switch (ev.type) {
						case 'session': {
							if (typeof ev.sessionId === 'string') {
								this.lastSessionId = ev.sessionId;
								// A brand-new conversation just learned its id — mark it active
								// so its sidebar row shows "Working…" too.
								chatActivityStore.start(ev.sessionId);
							}
							break;
						}
						case 'thinking-start': {
							this.items.push({
								kind: 'thinking',
								id: crypto.randomUUID(),
								text: '',
								active: true
							});
							thinkingIdx = this.items.length - 1;
							thinkStart = Date.now();
							this.status = 'thinking';
							this.statusLabel = 'Thinking…';
							break;
						}
						case 'thinking-delta': {
							const item = thinkingIdx !== null ? this.items[thinkingIdx] : null;
							if (item?.kind === 'thinking') item.text += String(ev.delta ?? '');
							break;
						}
						case 'thinking-stop': {
							const item = thinkingIdx !== null ? this.items[thinkingIdx] : null;
							if (item?.kind === 'thinking') {
								item.active = false;
								item.durationMs = Date.now() - thinkStart;
							}
							thinkingIdx = null;
							break;
						}
						case 'message-start': {
							this.items.push({
								kind: 'assistant',
								id: String(ev.id ?? crypto.randomUUID()),
								text: ''
							});
							assistantIdx = this.items.length - 1;
							this.status = 'responding';
							this.statusLabel = '';
							break;
						}
						case 'text-delta': {
							if (assistantIdx === null) {
								this.items.push({ kind: 'assistant', id: crypto.randomUUID(), text: '' });
								assistantIdx = this.items.length - 1;
							}
							const item = this.items[assistantIdx];
							if (item?.kind === 'assistant') item.text += String(ev.delta ?? '');
							this.status = 'responding';
							this.statusLabel = '';
							break;
						}
						case 'tool-call': {
							this.items.push({
								kind: 'tool',
								id: String(ev.id ?? crypto.randomUUID()),
								name: String(ev.name ?? ''),
								icon: String(ev.icon ?? '🔧'),
								label: String(ev.label ?? ev.name ?? 'Working'),
								detail: typeof ev.detail === 'string' ? ev.detail : undefined,
								status: 'running'
							});
							this.status = 'tool';
							this.statusLabel = String(ev.pending ?? 'Working…');
							// A new response block follows a tool call — drop the stale assistant ref.
							assistantIdx = null;
							break;
						}
						case 'tool-result': {
							const i = this.items.findIndex(
								(it) => it.kind === 'tool' && it.id === ev.id && it.status === 'running'
							);
							const target =
								i >= 0
									? this.items[i]
									: [...this.items]
											.reverse()
											.find((it) => it.kind === 'tool' && it.status === 'running');
							if (target && target.kind === 'tool') target.status = ev.isError ? 'error' : 'done';
							break;
						}
						case 'tool-pending': {
							// The model started a tool call; its input is still streaming (no text),
							// which can take a while. Show a working indicator now — the real
							// `tool-call` (with the chip) reconciles it when the input finishes.
							this.status = 'tool';
							this.statusLabel = String(ev.pending ?? 'Working…');
							break;
						}
						case 'ask-user': {
							this.items.push({
								kind: 'questions',
								id: String(ev.id ?? crypto.randomUUID()),
								payload: ev.payload as AskUserPayload,
								answered: false
							});
							// The agent handed control to the user — stop the working indicator.
							this.status = 'idle';
							this.statusLabel = '';
							assistantIdx = null;
							break;
						}
						case 'usage': {
							const used = Number(ev.used);
							const total = Number(ev.total);
							if (Number.isFinite(used) && Number.isFinite(total) && total > 0) {
								this.usage = { used, total };
							}
							break;
						}
						case 'trip-created': {
							if (typeof ev.slug === 'string') this.createdTripSlug = ev.slug;
							break;
						}
						case 'error': {
							if (ev.kind === 'auth_required') this.authRequired = true;
							else this.error = { kind: String(ev.kind ?? 'agent_error') };
							this.status = 'error';
							break;
						}
						// 'done' — server has persisted; the stream closes next.
					}
				}
			}
		} catch {
			// Aborts (stop button / navigation) are expected — only surface real failures.
			if (!controller.signal.aborted) {
				this.error = { kind: 'network' };
				this.status = 'error';
			}
		} finally {
			// Turn settled — clear the live "Working…" indicator for this session.
			chatActivityStore.stop(this.lastSessionId ?? resumeId ?? null);
			// The chat set changed (new session and/or appended messages are now
			// persisted) — signal chat lists to refresh without a page reload.
			chatActivityStore.bump();
			// Close out any thinking block left open by an abort/error.
			if (thinkingIdx !== null) {
				const item = this.items[thinkingIdx];
				if (item?.kind === 'thinking') item.active = false;
			}
			this.streaming = false;
			if (this.status !== 'error') {
				this.status = 'idle';
				this.statusLabel = '';
			}
			this.#controller = null;
			await opts.onDone?.();
		}
	}
}

export function createChatSession(): ChatSession {
	return new ChatSession();
}
