import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { log, ChatRequestSchema } from '$lib';
import type { ChatMessage } from '$lib/schemas';
import { formatTool } from '$lib/ai/formatTool';
import * as chatsService from '$lib/server/services/chats.service';
import { isViewerMode } from '$lib/server/env.server';

const encoder = new TextEncoder();

function sseEvent(data: unknown): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const POST: RequestHandler = async ({ request }) => {
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

	const { tripSlug, message, model, sessionId } = parsed.data;
	log.info(
		{ reqId, tripSlug, model, sessionId, messageChars: message.length },
		'Chat request: validated'
	);

	// Resume an explicit session when given; otherwise resume a real trip's thread,
	// or start a brand-new conversation for "new trip" turns.
	let chat = sessionId ? await chatsService.getChatBySession(sessionId) : null;
	if (!chat) {
		chat = tripSlug
			? await chatsService.getOrCreateChat(tripSlug)
			: await chatsService.createChat(null);
	}
	const isResume = chat.messages.length > 0;
	log.info(
		{ reqId, sessionId: chat.sessionId, isResume, existingMessages: chat.messages.length },
		'Chat request: chat record ready'
	);

	// Track the trip slug used at request start — `create_trip` may set it
	// later for "new trip" threads.
	let activeTripSlug = tripSlug;

	const userMsg: ChatMessage = {
		id: crypto.randomUUID(),
		role: 'user',
		content: message,
		createdAt: Date.now()
	};

	const newMessages: ChatMessage[] = [userMsg];

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
			// Token footprint of the most recent API call (the conversation's current
			// context occupancy). `result.modelUsage` is cumulative across the whole
			// agentic turn, so it overcounts — the last assistant message's input is
			// the real "how full is the window" figure.
			let lastUsedTokens = 0;

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
				} catch (e) {
					log.error({ err: e }, 'Failed to persist chat messages');
				}
			};

			try {
				for await (const msg of runAgentTurn({
					tripSlug,
					sessionId: chat.sessionId,
					resume: isResume,
					message,
					model,
					signal: abortCtrl.signal
				})) {
					if (msg.type === 'stream_event') {
						const ev = msg.event;
						if (ev.type === 'content_block_delta') {
							if (ev.delta?.type === 'text_delta') {
								// Text begins → the thinking block (if any) is done.
								flushThinking();
								if (!assistantStarted) {
									assistantStarted = true;
									controller.enqueue(sseEvent({ type: 'message-start', id: assistantId }));
								}
								assistantText += ev.delta.text;
								controller.enqueue(sseEvent({ type: 'text-delta', delta: ev.delta.text }));
							} else if (ev.delta?.type === 'thinking_delta') {
								if (!thinkingActive) {
									thinkingActive = true;
									controller.enqueue(sseEvent({ type: 'thinking-start' }));
								}
								thinkingText += ev.delta.thinking;
								controller.enqueue(sseEvent({ type: 'thinking-delta', delta: ev.delta.thinking }));
							}
						}
					} else if (msg.type === 'assistant') {
						if (msg.error === 'authentication_failed') {
							controller.enqueue(sseEvent({ type: 'error', kind: 'auth_required' }));
							break;
						}
						// Track the latest prompt size (history + cached context + this
						// reply) as the conversation's current context footprint.
						const u = msg.message.usage;
						if (u) {
							lastUsedTokens =
								(u.input_tokens ?? 0) +
								(u.cache_read_input_tokens ?? 0) +
								(u.cache_creation_input_tokens ?? 0) +
								(u.output_tokens ?? 0);
						}
						// Tool uses arrive on the final assistant message. A tool means
						// any open thinking block has ended.
						for (const block of msg.message.content) {
							if (block.type === 'tool_use') {
								flushThinking();
								const name = block.name.replace(/^mcp__trip-planner__/, '');
								const display = formatTool(name, block.input);
								controller.enqueue(
									sseEvent({
										type: 'tool-call',
										id: block.id,
										name,
										icon: display.icon,
										label: display.label,
										pending: display.pending,
										detail: display.detail
									})
								);
								// Track newly-created trip so we can link the chat to it, and
								// tell the client so it can surface a "View your trip" link.
								if (name === 'create_trip') {
									const input = block.input as Record<string, unknown>;
									if (typeof input.slug === 'string') {
										activeTripSlug = input.slug;
										controller.enqueue(sseEvent({ type: 'trip-created', slug: input.slug }));
									}
								}
								newMessages.push({
									id: crypto.randomUUID(),
									role: 'tool',
									toolName: name,
									content: display.label,
									detail: display.detail,
									createdAt: Date.now()
								});
							}
						}
					} else if (msg.type === 'user') {
						// Tool results — emit a tool-result event for visibility.
						const content = msg.message.content;
						if (Array.isArray(content)) {
							for (const block of content) {
								if (
									typeof block === 'object' &&
									block &&
									(block as { type?: string }).type === 'tool_result'
								) {
									const result = block as { tool_use_id?: string; is_error?: boolean };
									controller.enqueue(
										sseEvent({
											type: 'tool-result',
											id: result.tool_use_id,
											isError: result.is_error ?? false
										})
									);
								}
							}
						}
					} else if (msg.type === 'result') {
						// Surface context usage: footprint from the last assistant turn,
						// window size from the SDK's per-model accounting.
						const total = Math.max(
							0,
							...Object.values(msg.modelUsage ?? {}).map((m) => m.contextWindow ?? 0)
						);
						if (lastUsedTokens > 0 && total > 0) {
							controller.enqueue(sseEvent({ type: 'usage', used: lastUsedTokens, total }));
						}
						if (msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution') {
							turnError = 'agent_error';
							controller.enqueue(
								sseEvent({ type: 'error', kind: 'agent_error', subtype: msg.subtype })
							);
						}
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
