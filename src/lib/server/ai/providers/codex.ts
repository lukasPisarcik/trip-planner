import { Codex, type ThreadEvent, type ThreadItem } from '@openai/codex-sdk';
import { log } from '$lib';
import { PrivateEnvValue } from '../../env.server';
import { AgentTimeoutError, createTurnWatchdog, type NormalizedTurnEvent } from '../events';
import type { AgentTurnOptions } from '../agent';

// Approximate context window per Codex model, for the usage gauge. Codex's
// turn.completed doesn't report a window size, so these are best-effort —
// adjust to match the models your Codex CLI actually serves.
const CONTEXT_WINDOW: Record<string, number> = {
	'gpt-5-codex': 400_000,
	'gpt-5': 400_000
};

/** Longest common-prefix suffix — the newly-added text since the last emit. */
function suffixDelta(prev: string, full: string): string | null {
	if (full === prev) return null;
	if (full.startsWith(prev)) return full.slice(prev.length);
	return full; // non-monotonic replacement (rare) — resend whole
}

/**
 * Run a turn through the Codex SDK (the local `codex` CLI), translating its native
 * item/turn event stream into provider-neutral {@link NormalizedTurnEvent}s — the
 * same union the Claude runner emits, so the chat route handles both identically.
 *
 * Notes / points to validate against your installed Codex CLI version:
 *  - The trip tools are reached over MCP: ThreadOptions has no `mcpServers`, so the
 *    server is configured through `--config` overrides (`config.mcp_servers.*`),
 *    pointing at this app's in-app MCP endpoint (/api/mcp/trip-planner). The exact
 *    streamable-HTTP MCP config keys (`url` / `bearer_token` / the experimental flag)
 *    may vary by Codex version.
 *  - There is no system-prompt option, so the prompt is prepended to the message.
 *  - Codex mints its own thread id (emitted as `thread-id` for resume).
 */
export async function* runCodexTurn(
	opts: AgentTurnOptions,
	systemPrompt: string
): AsyncGenerator<NormalizedTurnEvent> {
	const {
		sessionId,
		resume,
		message,
		model: requestedModel,
		signal,
		codexThreadId,
		mcpBaseUrl
	} = opts;

	const codexPath = PrivateEnvValue('CODEX_PATH');
	const model = requestedModel ?? PrivateEnvValue('OPENAI_MODEL');
	const stallMs = PrivateEnvValue('AGENT_STALL_TIMEOUT_MS');
	const maxMs = PrivateEnvValue('AGENT_MAX_TURN_MS');
	const bridgeSecret = PrivateEnvValue('MCP_BRIDGE_SECRET');
	const wd = createTurnWatchdog(signal, stallMs, maxMs);

	const mcpUrl = `${mcpBaseUrl ?? 'http://127.0.0.1:5173'}/api/mcp/trip-planner`;
	const codex = new Codex({
		...(codexPath ? { codexPathOverride: codexPath } : {}),
		// MCP servers + the streamable-HTTP client flag, via `--config` overrides.
		config: {
			experimental_use_rmcp_client: true,
			mcp_servers: {
				'trip-planner': {
					url: mcpUrl,
					...(bridgeSecret ? { bearer_token: bridgeSecret } : {})
				}
			}
		}
	});

	const threadOptions = {
		model,
		// The agent only mutates trips through MCP tools and reads the web — never the
		// filesystem. read-only sandbox + never-approve keeps it from running commands.
		sandboxMode: 'read-only' as const,
		approvalPolicy: 'never' as const,
		skipGitRepoCheck: true,
		webSearchEnabled: true
	};

	// No system-prompt option on Codex — prepend it. Sent every turn so the agent
	// always has the current trip state + guidance (mirrors the Claude path, which
	// passes systemPrompt each turn; Codex caches the repeated input tokens).
	const prompt = `${systemPrompt}\n\n---\n\nUser request:\n${message}`;

	log.info(
		{
			sessionId,
			resume: !!resume,
			model,
			codexPath: codexPath ?? '(auto)',
			codexThreadId: codexThreadId ?? '(new)',
			mcpUrl,
			messageChars: message.length,
			systemPromptChars: systemPrompt.length
		},
		'Starting Codex turn'
	);

	const thread =
		resume && codexThreadId
			? codex.resumeThread(codexThreadId, threadOptions)
			: codex.startThread(threadOptions);

	let count = 0;
	let mode: 'idle' | 'thinking' | 'text' = 'idle';
	// Last full text emitted per item id, so updated/completed events emit only the delta.
	const emitted = new Map<string, string>();
	const leaveThinking = function* (): Generator<NormalizedTurnEvent> {
		if (mode === 'thinking') yield { type: 'thinking-stop' };
	};

	wd.resetStall();
	try {
		const { events } = await thread.runStreamed(prompt, { signal: wd.ctrl.signal });
		for await (const ev of events as AsyncGenerator<ThreadEvent>) {
			wd.resetStall();
			count++;

			if (ev.type === 'thread.started') {
				yield { type: 'thread-id', provider: 'openai', id: ev.thread_id };
				continue;
			}
			if (ev.type === 'turn.started') continue;

			if (
				ev.type === 'item.started' ||
				ev.type === 'item.updated' ||
				ev.type === 'item.completed'
			) {
				const item = ev.item as ThreadItem;
				const done = ev.type === 'item.completed';

				if (item.type === 'agent_message') {
					const delta = suffixDelta(emitted.get(item.id) ?? '', item.text);
					if (delta) {
						yield* leaveThinking();
						if (mode !== 'text') {
							yield { type: 'text-start' };
							mode = 'text';
						}
						yield { type: 'text-delta', delta };
						emitted.set(item.id, item.text);
					}
				} else if (item.type === 'reasoning') {
					const delta = suffixDelta(emitted.get(item.id) ?? '', item.text);
					if (delta) {
						if (mode !== 'thinking') {
							yield { type: 'thinking-start' };
							mode = 'thinking';
						}
						yield { type: 'thinking-delta', delta };
						emitted.set(item.id, item.text);
					}
				} else if (item.type === 'mcp_tool_call') {
					if (!done) {
						// Dispatched — show the "working" chip immediately.
						yield* leaveThinking();
						mode = 'idle';
						yield { type: 'tool-pending', id: item.id, name: item.tool };
					} else {
						// Completed — surface the call (with args, for ask_user/create_trip
						// handling in the route) then its result.
						yield { type: 'tool-call', id: item.id, name: item.tool, input: item.arguments };
						yield {
							type: 'tool-result',
							id: item.id,
							isError: item.status === 'failed' || !!item.error
						};
					}
				}
				continue;
			}

			if (ev.type === 'turn.completed') {
				const u = ev.usage;
				const used =
					(u?.input_tokens ?? 0) + (u?.cached_input_tokens ?? 0) + (u?.output_tokens ?? 0);
				const total = CONTEXT_WINDOW[model] ?? 0;
				yield* leaveThinking();
				mode = 'idle';
				if (used > 0 && total > 0) yield { type: 'usage', used, total };
				log.info({ sessionId, messages: count }, 'Codex turn finished');
				return;
			}

			if (ev.type === 'turn.failed') {
				yield* leaveThinking();
				mode = 'idle';
				if (isAuthError(ev.error?.message)) {
					yield { type: 'auth-required' };
					return;
				}
				log.warn({ sessionId, err: ev.error?.message }, 'Codex turn failed');
				yield { type: 'turn-error', subtype: 'error_during_execution' };
				return;
			}

			if (ev.type === 'error') {
				if (isAuthError(ev.message)) {
					yield { type: 'auth-required' };
					return;
				}
				throw new Error(ev.message);
			}
		}
		log.info({ sessionId, messages: count }, 'Codex turn finished (stream end)');
	} catch (err) {
		const reason = wd.timedOut();
		if (reason) {
			log.warn({ sessionId, reason, messages: count, stallMs, maxMs }, 'Codex turn timed out');
			throw new AgentTimeoutError(reason);
		}
		const msg = err instanceof Error ? err.message : String(err);
		if (isAuthError(msg)) {
			yield { type: 'auth-required' };
			return;
		}
		log.error({ sessionId, err: msg }, 'Codex turn threw');
		throw err;
	} finally {
		wd.cleanup();
	}
}

/** Heuristic: does this error message mean the local Codex CLI isn't signed in? */
function isAuthError(message: string | undefined): boolean {
	if (!message) return false;
	return /not logged in|unauthorized|not authenticated|auth\w*\s*(failed|required)|\b401\b|\b403\b|login/i.test(
		message
	);
}
