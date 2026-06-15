import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { log } from '$lib';
import type { ChatModel } from '$lib/schemas';
import { PrivateEnvValue } from '../env.server';
import { tripMcpServer, tripAllowedToolNames } from './tools';
import { newTripSystemPrompt, editTripSystemPrompt } from './prompts';
import * as tripsService from '../services/trips.service';

export interface AgentTurnOptions {
	tripSlug: string | null;
	sessionId: string;
	resume?: boolean;
	message: string;
	model?: ChatModel;
	signal?: AbortSignal;
}

/** Built-in CLI tools the agent may use for live research. */
const WEB_TOOLS = ['WebSearch', 'WebFetch'] as const;

/** Thrown when the turn watchdog aborts a stalled or over-long agent turn. */
export class AgentTimeoutError extends Error {
	constructor(public readonly reason: 'stall' | 'max') {
		super(`Agent turn aborted (${reason} timeout)`);
		this.name = 'AgentTimeoutError';
	}
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

export async function* runAgentTurn(opts: AgentTurnOptions): AsyncGenerator<SDKMessage> {
	const { tripSlug, sessionId, resume, message, model: requestedModel, signal } = opts;

	let systemPrompt: string;
	if (tripSlug) {
		const trip = await tripsService.getTrip(tripSlug);
		if (!trip) throw new Error(`Trip "${tripSlug}" not found`);
		systemPrompt = editTripSystemPrompt(trip);
	} else {
		systemPrompt = newTripSystemPrompt();
	}

	const claudePath = PrivateEnvValue('CLAUDE_CODE_PATH');
	const model = requestedModel ?? PrivateEnvValue('ANTHROPIC_MODEL');
	const stallMs = PrivateEnvValue('AGENT_STALL_TIMEOUT_MS');
	const maxMs = PrivateEnvValue('AGENT_MAX_TURN_MS');
	const stderr = makeStderrCapture('runAgentTurn');

	// One controller drives both the watchdog and the external signal (client
	// disconnect / stop button). Without this a stalled API stream hangs forever
	// and orphans the CLI subprocess.
	const ctrl = new AbortController();
	if (signal) {
		if (signal.aborted) ctrl.abort();
		else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
	}

	// Watchdog: `stallTimer` fires when the SDK goes quiet (reset on every
	// message); `maxTimer` caps total runtime. Either aborts the turn.
	let timedOut: 'stall' | 'max' | null = null;
	let stallTimer: ReturnType<typeof setTimeout> | undefined;
	const resetStall = () => {
		clearTimeout(stallTimer);
		stallTimer = setTimeout(() => {
			timedOut = 'stall';
			ctrl.abort();
		}, stallMs);
	};
	const maxTimer = setTimeout(() => {
		timedOut = 'max';
		ctrl.abort();
	}, maxMs);

	log.info(
		{
			sessionId,
			resume: !!resume,
			tripSlug,
			model,
			claudePath: claudePath ?? '(auto)',
			messageChars: message.length,
			systemPromptChars: systemPrompt.length,
			stallMs,
			maxMs
		},
		'Starting agent turn'
	);

	const q = query({
		prompt: message,
		options: {
			model,
			systemPrompt,
			mcpServers: { 'trip-planner': tripMcpServer },
			// Trip tools + the CLI's built-in web tools so the agent can verify
			// current hours/prices/ratings and surface trending spots. `tools` lists
			// the enabled built-ins; `allowedTools` is the no-prompt allowlist.
			allowedTools: [...tripAllowedToolNames, ...WEB_TOOLS],
			tools: [...WEB_TOOLS],
			// Isolate the agent from the host's Claude Code config. `query()` loads
			// every filesystem setting source by default, which dragged the user's
			// global MCP servers (e.g. Playwright) and their tool allow-lists into
			// the turn — the agent then called `browser_run_code_unsafe` and stalled.
			// `[]` = SDK isolation; `strictMcpConfig` honors only the servers below.
			settingSources: [],
			strictMcpConfig: true,
			// Belt-and-braces: never let general-purpose built-ins through even if a
			// future option change re-enables filesystem settings.
			disallowedTools: ['Bash', 'Read', 'Write', 'Edit', 'NotebookEdit'],
			includePartialMessages: true,
			stderr: stderr.cb,
			...(resume ? { resume: sessionId } : { sessionId }),
			...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
			abortController: ctrl
		}
	});

	let count = 0;
	resetStall();
	try {
		for await (const msg of q) {
			resetStall();
			count++;
			log.debug(
				{
					sessionId,
					n: count,
					type: msg.type,
					subtype: 'subtype' in msg ? msg.subtype : undefined
				},
				'SDK message'
			);
			yield msg;
		}
		log.info({ sessionId, messages: count }, 'Agent turn finished');
	} catch (err) {
		if (timedOut) {
			log.warn(
				{ sessionId, reason: timedOut, messages: count, stallMs, maxMs },
				'Agent turn timed out'
			);
			throw new AgentTimeoutError(timedOut);
		}
		log.error(
			{
				sessionId,
				err: err instanceof Error ? err.message : String(err),
				stderr: stderr.lines.slice(-20)
			},
			'Agent turn threw'
		);
		throw err;
	} finally {
		clearTimeout(stallTimer);
		clearTimeout(maxTimer);
	}
}
