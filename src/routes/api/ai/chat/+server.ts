import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { log, ChatRequestSchema } from '$lib';
import {
	type ChatMessage,
	type ChatProvider,
	AskUserPayloadSchema,
	providerOf
} from '$lib/schemas';
import { formatTool } from '$lib/ai/formatTool';
import * as chatsService from '$lib/server/services/chats.service';
import { isViewerMode } from '$lib/server/env.server';

const encoder = new TextEncoder();

function sseEvent(data: unknown): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const POST: RequestHandler = async ({ request, url }) => {
	// Read-only public deployment: the co-pilot is disabled. Bail before importing
	// the agent — it spawns the Claude Code CLI, which can't run on serverless.
	if (isViewerMode()) throw error(404, 'Not found');

	const reqId = crypto.randomUUID();
	const raw = await request.json();
	const parsed = ChatRequestSchema.safeParse(raw);
	if (!parsed.success) {
		log.warn({ reqId, raw }, 'Chat request: invalid body');
		throw error(400, 'Invalid request body');
	}

	const { tripSlug, message, model, sessionId, newChat, messageId } = parsed.data;
	log.info(
		{ reqId, tripSlug, model, sessionId, messageChars: message.length },
		'Chat request: validated'
	);

	// Resume an explicit session when given; otherwise resume a real trip's thread,
	// or start a brand-new conversation for "new trip" turns.
	let chat = sessionId ? await chatsService.getChatBySession(sessionId) : null;
	if (!chat) {
		// `newChat` (explicit "New chat" / "New conversation") always starts fresh.
		// Otherwise a trip-scoped turn resumes that trip's latest thread.
		chat = newChat
			? await chatsService.createChat(tripSlug)
			: tripSlug
				? await chatsService.getOrCreateChat(tripSlug)
				: await chatsService.createChat(null);
	}
	const isResume = chat.messages.length > 0;
	// Only resume the provider-native thread when the same provider owns it; a
	// provider switch starts a fresh thread (the visible message history persists).
	const turnProvider: ChatProvider = model ? providerOf(model) : 'anthropic';
	const canResume = isResume && (chat.provider ?? 'anthropic') === turnProvider;
	log.info(
		{
			reqId,
			sessionId: chat.sessionId,
			isResume,
			canResume,
			turnProvider,
			existingMessages: chat.messages.length
		},
		'Chat request: chat record ready'
	);

	// Track the trip slug used at request start — `create_trip` may set it
	// later for "new trip" threads.
	let activeTripSlug = tripSlug;

	const userMsg: ChatMessage = {
		// Reuse the client's id so its live echo and this persisted copy dedupe when a
		// surface renders both (e.g. expanding a running chat into the agent workspace).
		id: messageId ?? crypto.randomUUID(),
		role: 'user',
		content: message,
		createdAt: Date.now()
	};

	// Persist the user's message up front so the conversation gets a sidebar/list
	// row immediately. `listChats` hides empty threads and the rest of the turn's
	// messages aren't persisted until finalize() (turn end), which left a freshly
	// created chat invisible — and so un-resumable (e.g. when expanding into the
	// agent workspace) — for the entire turn. Best-effort: on failure we fall back
	// to persisting everything in finalize().
	let userPersisted = false;
	try {
		await chatsService.appendMessages(chat.sessionId, [userMsg]);
		userPersisted = true;
	} catch (e) {
		log.warn(
			{ reqId, sessionId: chat.sessionId, err: e instanceof Error ? e.message : String(e) },
			'Failed to persist user message up front; will persist it with the turn'
		);
	}

	// Messages produced during the turn (assistant/tool/thinking/questions/error).
	// The user message is already persisted above unless that write failed.
	const newMessages: ChatMessage[] = userPersisted ? [] : [userMsg];

	// One controller aborts the agent on either client disconnect (request.signal)
	// or stream cancellation (reader.cancel()). runAgentTurn merges this with its
	// own watchdog so a stalled turn never orphans the CLI subprocess.
	const abortCtrl = new AbortController();
	if (request.signal.aborted) abortCtrl.abort();
	else request.signal.addEventListener('abort', () => abortCtrl.abort(), { once: true });

	// Lazy-load the agent so the Claude Code SDK (subprocess-based) is never
	// pulled into the bundle on read-only deployments that bail out above.
	const { runAgentTurn, AgentTimeoutError } = await import('$lib/server/ai/agent');

	const stream = new ReadableStream({
		async start(controller) {
			// Tell the client which session this turn belongs to, so a fresh
			// /agent page can navigate to /agent/[sessionId] once the turn settles.
			controller.enqueue(sseEvent({ type: 'session', sessionId: chat.sessionId }));

			const assistantId = crypto.randomUUID();
			let assistantText = '';
			let assistantStarted = false;
			// Set when the turn fails before producing any reply. Persisted as an
			// `error` message in finalize() so a reload shows what went wrong rather
			// than a dangling, unanswered user message.
			let turnError: string | null = null;
			// Provider + native thread id learned this turn (via the `thread-id` event),
			// persisted in finalize() so the next turn resumes with the right SDK.
			let capturedProvider: ChatProvider = turnProvider;
			let capturedThreadId: string | null = null;

			// Live thinking block being accumulated (a turn can have several,
			// interleaved with tool calls). Flushed into newMessages on stop.
			let thinkingText = '';
			let thinkingActive = false;

			const flushThinking = () => {
				if (thinkingActive) {
					controller.enqueue(sseEvent({ type: 'thinking-stop' }));
					thinkingActive = false;
				}
				if (thinkingText.trim()) {
					newMessages.push({
						id: crypto.randomUUID(),
						role: 'thinking',
						content: thinkingText.trim(),
						createdAt: Date.now()
					});
					thinkingText = '';
				}
			};

			const finalize = async () => {
				flushThinking();
				if (assistantText) {
					newMessages.push({
						id: assistantId,
						role: 'assistant',
						content: assistantText,
						createdAt: Date.now()
					});
				} else if (turnError) {
					// The turn failed before saying anything — record it so the
					// conversation reloads with an explanation, not a hanging question.
					newMessages.push({
						id: crypto.randomUUID(),
						role: 'error',
						content:
							turnError === 'timeout'
								? 'The agent ran out of time before finishing. Send your message again to continue.'
								: 'The agent hit an error before finishing. Try again.',
						createdAt: Date.now()
					});
				}
				try {
					await chatsService.appendMessages(chat.sessionId, newMessages);
					if (!tripSlug && activeTripSlug && activeTripSlug !== tripSlug) {
						await chatsService.setTripSlug(chat.sessionId, activeTripSlug);
					}
					// Persist the provider + native thread id when it changed, so the next
					// turn resumes the right thread (skips redundant writes in steady state).
					if (
						capturedThreadId &&
						(capturedThreadId !== chat.providerThreadId ||
							(chat.provider ?? 'anthropic') !== capturedProvider)
					) {
						await chatsService.setProviderThread(
							chat.sessionId,
							capturedProvider,
							capturedThreadId
						);
					}
				} catch (e) {
					log.error({ err: e }, 'Failed to persist chat messages');
				}
			};

			try {
				for await (const ev of runAgentTurn({
					tripSlug,
					sessionId: chat.sessionId,
					resume: canResume,
					message,
					model,
					signal: abortCtrl.signal,
					codexThreadId: chat.providerThreadId ?? null,
					mcpBaseUrl: url.origin
				})) {
					switch (ev.type) {
						case 'thread-id':
							// Provider + native resume id learned this turn; persisted in finalize().
							capturedProvider = ev.provider;
							capturedThreadId = ev.id;
							break;

						case 'thinking-start':
							if (!thinkingActive) {
								thinkingActive = true;
								controller.enqueue(sseEvent({ type: 'thinking-start' }));
							}
							break;

						case 'thinking-delta':
							thinkingText += ev.delta;
							controller.enqueue(sseEvent({ type: 'thinking-delta', delta: ev.delta }));
							break;

						case 'thinking-stop':
							flushThinking();
							break;

						case 'text-start':
						case 'text-delta':
							// Text begins → the thinking block (if any) is done.
							flushThinking();
							if (!assistantStarted) {
								assistantStarted = true;
								controller.enqueue(sseEvent({ type: 'message-start', id: assistantId }));
							}
							if (ev.type === 'text-delta') {
								assistantText += ev.delta;
								controller.enqueue(sseEvent({ type: 'text-delta', delta: ev.delta }));
							}
							break;

						case 'tool-pending': {
							// Surface a "working" indicator immediately instead of a dead pause.
							flushThinking();
							const display = formatTool(ev.name, {});
							controller.enqueue(
								sseEvent({
									type: 'tool-pending',
									id: ev.id,
									name: ev.name,
									icon: display.icon,
									pending: display.pending
								})
							);
							break;
						}

						case 'tool-call': {
							flushThinking();
							// `ask_user` is rendered as an interactive form, not a tool chip.
							if (ev.name === 'ask_user') {
								const parsed = AskUserPayloadSchema.safeParse(ev.input);
								if (parsed.success) {
									const qId = crypto.randomUUID();
									controller.enqueue(sseEvent({ type: 'ask-user', id: qId, payload: parsed.data }));
									newMessages.push({
										id: qId,
										role: 'questions',
										content: parsed.data.intro ?? 'A few quick questions',
										questions: parsed.data,
										createdAt: Date.now()
									});
									break;
								}
								// invalid payload → fall through to render it as a normal tool chip
							}
							const display = formatTool(ev.name, ev.input);
							controller.enqueue(
								sseEvent({
									type: 'tool-call',
									id: ev.id,
									name: ev.name,
									icon: display.icon,
									label: display.label,
									pending: display.pending,
									detail: display.detail
								})
							);
							// Track newly-created trip so we can link the chat to it, and tell
							// the client so it can surface a "View your trip" link.
							if (ev.name === 'create_trip') {
								const input = ev.input as Record<string, unknown>;
								if (typeof input.slug === 'string') {
									activeTripSlug = input.slug;
									controller.enqueue(sseEvent({ type: 'trip-created', slug: input.slug }));
								}
							}
							newMessages.push({
								id: crypto.randomUUID(),
								role: 'tool',
								toolName: ev.name,
								content: display.label,
								detail: display.detail,
								createdAt: Date.now()
							});
							break;
						}

						case 'tool-result':
							controller.enqueue(sseEvent({ type: 'tool-result', id: ev.id, isError: ev.isError }));
							break;

						case 'usage':
							if (ev.used > 0 && ev.total > 0) {
								controller.enqueue(sseEvent({ type: 'usage', used: ev.used, total: ev.total }));
							}
							break;

						case 'auth-required':
							controller.enqueue(sseEvent({ type: 'error', kind: 'auth_required' }));
							break;

						case 'turn-error':
							turnError = 'agent_error';
							controller.enqueue(
								sseEvent({ type: 'error', kind: 'agent_error', subtype: ev.subtype })
							);
							break;
					}
				}
			} catch (e) {
				const isTimeout = e instanceof AgentTimeoutError;
				const isAbort = abortCtrl.signal.aborted && !isTimeout;
				if (isAbort) {
					// Client stopped/disconnected — not an error worth surfacing.
					log.info({ reqId, sessionId: chat.sessionId }, 'Agent turn aborted by client');
				} else {
					turnError = isTimeout ? 'timeout' : 'agent_error';
					log.error(
						{ reqId, sessionId: chat.sessionId, err: e instanceof Error ? e.message : String(e) },
						'Agent turn failed'
					);
					controller.enqueue(
						sseEvent(
							isTimeout
								? { type: 'error', kind: 'timeout' }
								: {
										type: 'error',
										kind: 'agent_error',
										message: e instanceof Error ? e.message : 'unknown error'
									}
						)
					);
				}
			} finally {
				controller.enqueue(sseEvent({ type: 'done' }));
				await finalize();
				log.info({ reqId, sessionId: chat.sessionId }, 'Chat request: finished');
				controller.close();
			}
		},
		cancel() {
			// Consumer went away (navigation, stop button via reader.cancel()).
			// Abort the agent so the CLI subprocess is torn down promptly.
			abortCtrl.abort();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
};
