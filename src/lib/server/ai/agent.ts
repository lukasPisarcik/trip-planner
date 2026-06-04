import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { log } from '$lib';
import { PrivateEnvValue } from '../env.server';
import { tripMcpServer, tripAllowedToolNames } from './tools';
import { newTripSystemPrompt, editTripSystemPrompt } from './prompts';
import * as tripsService from '../services/trips.service';

export interface AgentTurnOptions {
	tripSlug: string | null;
	sessionId: string;
	resume?: boolean;
	message: string;
	signal?: AbortSignal;
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
	const { tripSlug, sessionId, resume, message, signal } = opts;

	let systemPrompt: string;
	if (tripSlug) {
		const trip = await tripsService.getTrip(tripSlug);
		if (!trip) throw new Error(`Trip "${tripSlug}" not found`);
		systemPrompt = editTripSystemPrompt(trip);
	} else {
		systemPrompt = newTripSystemPrompt();
	}

	const claudePath = PrivateEnvValue('CLAUDE_CODE_PATH');
	const model = PrivateEnvValue('ANTHROPIC_MODEL');
	const stderr = makeStderrCapture('runAgentTurn');

	log.info(
		{
			sessionId,
			resume: !!resume,
			tripSlug,
			model,
			claudePath: claudePath ?? '(auto)',
			messageChars: message.length,
			systemPromptChars: systemPrompt.length
		},
		'Starting agent turn'
	);

	const q = query({
		prompt: message,
		options: {
			model,
			systemPrompt,
			mcpServers: { 'trip-planner': tripMcpServer },
			allowedTools: [...tripAllowedToolNames],
			tools: [],
			includePartialMessages: true,
			stderr: stderr.cb,
			...(resume ? { resume: sessionId } : { sessionId }),
			...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
			...(signal ? { abortController: toAbortController(signal) } : {})
		}
	});

	let count = 0;
	try {
		for await (const msg of q) {
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
		log.error(
			{
				sessionId,
				err: err instanceof Error ? err.message : String(err),
				stderr: stderr.lines.slice(-20)
			},
			'Agent turn threw'
		);
		throw err;
	}
}

function toAbortController(signal: AbortSignal): AbortController {
	const ctrl = new AbortController();
	if (signal.aborted) ctrl.abort();
	else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
	return ctrl;
}
