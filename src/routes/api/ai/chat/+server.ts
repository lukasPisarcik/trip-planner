import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { log, ChatRequestSchema } from '$lib';
import type { ChatMessage } from '$lib/schemas';
import * as chatsService from '$lib/server/services/chats.service';
import { runAgentTurn } from '$lib/server/ai/agent';

const encoder = new TextEncoder();

function sseEvent(data: unknown): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const POST: RequestHandler = async ({ request }) => {
	const reqId = crypto.randomUUID();
	const raw = await request.json();
	const parsed = ChatRequestSchema.safeParse(raw);
	if (!parsed.success) {
		log.warn({ reqId, raw }, 'Chat request: invalid body');
		throw error(400, 'Invalid request body');
	}

	const { tripSlug, message } = parsed.data;
	log.info({ reqId, tripSlug, messageChars: message.length }, 'Chat request: validated');

	const chat = await chatsService.getOrCreateChat(tripSlug);
	const isResume = chat.messages.length > 0;
	log.info(
		{
			reqId,
			sessionId: chat.sessionId,
			isResume,
			existingMessages: chat.messages.length
		},
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

	const stream = new ReadableStream({
		async start(controller) {
			const assistantId = crypto.randomUUID();
			let assistantText = '';
			let assistantStarted = false;

			const finalize = async () => {
				if (assistantText) {
					newMessages.push({
						id: assistantId,
						role: 'assistant',
						content: assistantText,
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
					message
				})) {
					if (msg.type === 'stream_event') {
						const ev = msg.event;
						if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
							if (!assistantStarted) {
								assistantStarted = true;
								controller.enqueue(sseEvent({ type: 'message-start', id: assistantId }));
							}
							assistantText += ev.delta.text;
							controller.enqueue(sseEvent({ type: 'text-delta', delta: ev.delta.text }));
						}
					} else if (msg.type === 'assistant') {
						if (msg.error === 'authentication_failed') {
							controller.enqueue(sseEvent({ type: 'error', kind: 'auth_required' }));
							break;
						}
						// Tool uses come on the final assistant message.
						for (const block of msg.message.content) {
							if (block.type === 'tool_use') {
								controller.enqueue(
									sseEvent({
										type: 'tool-call',
										name: block.name.replace(/^mcp__trip-planner__/, ''),
										input: block.input
									})
								);
								// Track newly-created trip so we can link the chat to it.
								if (block.name.endsWith('create_trip')) {
									const input = block.input as Record<string, unknown>;
									if (typeof input.slug === 'string') activeTripSlug = input.slug;
								}
								newMessages.push({
									id: crypto.randomUUID(),
									role: 'tool',
									toolName: block.name.replace(/^mcp__trip-planner__/, ''),
									content: JSON.stringify(block.input, null, 2),
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
									const result = block as { content?: unknown; is_error?: boolean };
									controller.enqueue(
										sseEvent({
											type: 'tool-result',
											isError: result.is_error ?? false
										})
									);
								}
							}
						}
					} else if (msg.type === 'result') {
						if (msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution') {
							controller.enqueue(
								sseEvent({ type: 'error', kind: 'agent_error', subtype: msg.subtype })
							);
						}
						break;
					}
				}
			} catch (e) {
				log.error(
					{ reqId, sessionId: chat.sessionId, err: e instanceof Error ? e.message : String(e) },
					'Agent turn failed'
				);
				controller.enqueue(
					sseEvent({
						type: 'error',
						kind: 'agent_error',
						message: e instanceof Error ? e.message : 'unknown error'
					})
				);
			} finally {
				controller.enqueue(sseEvent({ type: 'done' }));
				await finalize();
				log.info({ reqId, sessionId: chat.sessionId }, 'Chat request: finished');
				controller.close();
			}
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
