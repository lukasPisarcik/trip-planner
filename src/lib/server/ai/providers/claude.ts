import { query } from '@anthropic-ai/claude-agent-sdk';
import { log } from '$lib';
import { PrivateEnvValue, subprocessEnv } from '../../env.server';
import { tripMcpServer, tripAllowedToolNames } from '../tools';
import { AgentTimeoutError, createTurnWatchdog, type NormalizedTurnEvent } from '../events';
import type { AgentTurnOptions } from '../agent';

/** Built-in CLI tools the agent may use for live research. */
const WEB_TOOLS = ['WebSearch', 'WebFetch'] as const;

/** Bare tool name from the SDK's `mcp__<server>__<tool>` form. */
function stripMcpPrefix(name: string): string {
	return name.replace(/^mcp__trip-planner__/, '');
}

function makeStderrCapture(scope: string) {
	const lines: string[] = [];
	return {
		lines,
		cb: (data: string) => {
			const trimmed = data.trimEnd();
			if (!trimmed) return;
			lines.push(trimmed);
			log.warn({ scope, stderr: trimmed }, '[agent-sdk stderr]');
		}
	};
}

/**
 * Run a turn through the Claude Code SDK (`query()`), translating its native
 * Anthropic message stream into provider-neutral {@link NormalizedTurnEvent}s.
 * A small thinking/text state machine emits clean start/stop boundaries so the
 * chat route can flush thinking blocks exactly as before.
 */
export async function* runClaudeTurn(
	opts: AgentTurnOptions,
	systemPrompt: string
): AsyncGenerator<NormalizedTurnEvent> {
	const { sessionId, resume, message, model: requestedModel, signal } = opts;

	const claudePath = PrivateEnvValue('CLAUDE_CODE_PATH');
	const model = requestedModel ?? PrivateEnvValue('ANTHROPIC_MODEL');
	const stallMs = PrivateEnvValue('AGENT_STALL_TIMEOUT_MS');
	const firstEventMs = PrivateEnvValue('AGENT_FIRST_EVENT_TIMEOUT_MS');
	const maxMs = PrivateEnvValue('AGENT_MAX_TURN_MS');
	const maxOutputTokens = PrivateEnvValue('AGENT_MAX_OUTPUT_TOKENS');
	const maxThinkingTokens = PrivateEnvValue('AGENT_MAX_THINKING_TOKENS');
	const stderr = makeStderrCapture('runClaudeTurn');
	// Graceful stop at the runtime cap: interrupt ends the turn like pressing Esc —
	// the CLI shuts down in order and the session stays resumable. Assigned once the
	// SDK query exists (inside the try, so a synchronous query() throw can never
	// leave a timer referencing an uninitialized binding); until then — and if
	// interrupt throws (e.g. unsupported for single-prompt sessions) — fall back to
	// the hard abort. The watchdog's 30s backstop covers a no-op interrupt.
	let softInterrupt: (() => void) | null = null;
	const wd = createTurnWatchdog(signal, {
		stallMs,
		firstEventMs,
		maxMs,
		onSoftMax: () => (softInterrupt ? softInterrupt() : wd.ctrl.abort())
	});

	log.info(
		{
			sessionId,
			resume: !!resume,
			model,
			claudePath: claudePath ?? '(auto)',
			messageChars: message.length,
			systemPromptChars: systemPrompt.length,
			stallMs,
			firstEventMs,
			maxMs,
			maxOutputTokens,
			maxThinkingTokens
		},
		'Starting Claude turn'
	);

	let count = 0;
	let lastUsedTokens = 0;
	// Track which content block we're in so we emit clean thinking/text boundaries.
	let mode: 'idle' | 'thinking' | 'text' = 'idle';
	const leaveThinking = function* (): Generator<NormalizedTurnEvent> {
		if (mode === 'thinking') yield { type: 'thinking-stop' };
	};

	// The app session id doubles as the Claude resume key — record it so resume
	// dispatch is uniform across providers (Codex emits its own thread id instead).
	yield { type: 'thread-id', provider: 'anthropic', id: sessionId };

	// query() can throw synchronously (e.g. a missing CLI binary) — created inside
	// the try so the finally always clears the watchdog timers.
	try {
		const q = query({
			prompt: message,
			options: {
				model,
				systemPrompt,
				maxThinkingTokens,
				// The spawned CLI honours CLAUDE_CODE_MAX_OUTPUT_TOKENS; its 32K default
				// truncated large tool calls mid-JSON (see AGENT_MAX_OUTPUT_TOKENS).
				env: subprocessEnv({ CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxOutputTokens) }),
				mcpServers: { 'trip-planner': tripMcpServer },
				// Trip tools + the CLI's built-in web tools so the agent can verify
				// current hours/prices/ratings and surface trending spots. `tools` lists
				// the enabled built-ins; `allowedTools` is the no-prompt allowlist.
				allowedTools: [...tripAllowedToolNames, ...WEB_TOOLS],
				tools: [...WEB_TOOLS],
				// Isolate the agent from the host's Claude Code config (global MCP servers,
				// tool allow-lists). `[]` = SDK isolation; `strictMcpConfig` honors only the
				// servers below.
				settingSources: [],
				strictMcpConfig: true,
				disallowedTools: ['Bash', 'Read', 'Write', 'Edit', 'NotebookEdit'],
				includePartialMessages: true,
				stderr: stderr.cb,
				...(resume ? { resume: sessionId } : { sessionId }),
				...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
				abortController: wd.ctrl
			}
		});
		softInterrupt = () => {
			q.interrupt().catch(() => wd.ctrl.abort());
		};

		wd.resetStall();
		for await (const msg of q) {
			wd.resetStall();
			count++;
			if (msg.type === 'stream_event') {
				const ev = msg.event;
				if (ev.type === 'content_block_delta') {
					if (ev.delta?.type === 'text_delta') {
						yield* leaveThinking();
						if (mode !== 'text') {
							yield { type: 'text-start' };
							mode = 'text';
						}
						yield { type: 'text-delta', delta: ev.delta.text };
					} else if (ev.delta?.type === 'thinking_delta') {
						if (mode !== 'thinking') {
							yield { type: 'thinking-start' };
							mode = 'thinking';
						}
						yield { type: 'thinking-delta', delta: ev.delta.thinking };
					}
				} else if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
					yield* leaveThinking();
					mode = 'idle';
					// A tool is now executing — pause the stall timer until its result.
					wd.enterTool(ev.content_block.id);
					yield {
						type: 'tool-pending',
						id: ev.content_block.id,
						name: stripMcpPrefix(ev.content_block.name)
					};
				}
			} else if (msg.type === 'assistant') {
				if (msg.error === 'authentication_failed') {
					yield { type: 'auth-required' };
					return;
				}
				// Track the latest prompt size (history + cached context + this reply) as
				// the conversation's current context footprint.
				const u = msg.message.usage;
				if (u) {
					lastUsedTokens =
						(u.input_tokens ?? 0) +
						(u.cache_read_input_tokens ?? 0) +
						(u.cache_creation_input_tokens ?? 0) +
						(u.output_tokens ?? 0);
				}
				for (const block of msg.message.content) {
					if (block.type === 'tool_use') {
						yield* leaveThinking();
						mode = 'idle';
						// Idempotent by id — content_block_start above may have already marked
						// this tool in flight; enterTool is a Set add either way.
						wd.enterTool(block.id);
						yield {
							type: 'tool-call',
							id: block.id,
							name: stripMcpPrefix(block.name),
							input: block.input
						};
					}
				}
			} else if (msg.type === 'user') {
				const content = msg.message.content;
				if (Array.isArray(content)) {
					for (const block of content) {
						if (
							typeof block === 'object' &&
							block &&
							(block as { type?: string }).type === 'tool_result'
						) {
							const result = block as { tool_use_id?: string; is_error?: boolean };
							const toolUseId = result.tool_use_id ?? '';
							// Result arrived — re-arm the stall timer (once no tool is in flight).
							// A missing id can't drain the in-flight set (enterTool used the real
							// block id), which would leave the stall paused for the rest of the
							// turn — surface it rather than swallowing it silently.
							if (!toolUseId) {
								log.warn(
									{ sessionId },
									'tool_result missing tool_use_id — stall timer stays paused'
								);
							}
							wd.exitTool(toolUseId);
							yield {
								type: 'tool-result',
								id: toolUseId,
								isError: result.is_error ?? false
							};
						}
					}
				}
			} else if (msg.type === 'result') {
				yield* leaveThinking();
				mode = 'idle';
				// Window size from the SDK's per-model accounting; footprint from the last turn.
				const total = Math.max(
					0,
					...Object.values(msg.modelUsage ?? {}).map((m) => m.contextWindow ?? 0)
				);
				if (lastUsedTokens > 0 && total > 0) {
					yield { type: 'usage', used: lastUsedTokens, total };
				}
				if (msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution') {
					yield { type: 'turn-error', subtype: msg.subtype };
				}
				// A soft-interrupted stream ends cleanly (interrupt ≙ Esc) — still surface
				// the timeout so the route persists the "ran out of time — continue" message.
				// But a turn whose final message merely RACED the cap (a clean success) is
				// not a timeout — don't report one.
				const cleanSuccess = msg.subtype === 'success' && !msg.is_error;
				if (wd.timedOut() === 'max' && !cleanSuccess) throw new AgentTimeoutError('max');
				log.info({ sessionId, messages: count }, 'Claude turn finished');
				return;
			}
		}
		if (wd.timedOut() === 'max') throw new AgentTimeoutError('max');
		log.info({ sessionId, messages: count }, 'Claude turn finished (stream end)');
	} catch (err) {
		const reason = wd.timedOut();
		if (reason) {
			log.warn({ sessionId, reason, messages: count, stallMs, maxMs }, 'Claude turn timed out');
			throw new AgentTimeoutError(reason);
		}
		log.error(
			{
				sessionId,
				err: err instanceof Error ? err.message : String(err),
				stderr: stderr.lines.slice(-20)
			},
			'Claude turn threw'
		);
		throw err;
	} finally {
		wd.cleanup();
	}
}
