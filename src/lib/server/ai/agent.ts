import type { ChatModel } from '$lib/schemas';
import { providerOf } from '$lib/schemas';
import { newTripSystemPrompt, editTripSystemPrompt } from './prompts';
import * as tripsService from '../services/trips.service';
import { AgentTimeoutError, type NormalizedTurnEvent } from './events';
import { runClaudeTurn } from './providers/claude';
import { runCodexTurn } from './providers/codex';

// Re-exported for the chat route, which catches it to distinguish a watchdog
// timeout from a genuine agent error.
export { AgentTimeoutError };

export interface AgentTurnOptions {
	tripSlug: string | null;
	sessionId: string;
	resume?: boolean;
	message: string;
	model?: ChatModel;
	signal?: AbortSignal;
	/** Codex's native thread id to resume (set when resuming an OpenAI thread). */
	codexThreadId?: string | null;
	/** Absolute base URL of this server, for the in-app MCP endpoint Codex connects to. */
	mcpBaseUrl?: string;
}

/**
 * Run one agent turn, yielding provider-neutral {@link NormalizedTurnEvent}s.
 *
 * The system prompt (new-trip vs edit-trip) is resolved once here — it's
 * provider-agnostic — then the turn is dispatched to the runner for the selected
 * model's provider: Anthropic via the Claude Code SDK, OpenAI via the Codex SDK.
 */
export async function* runAgentTurn(opts: AgentTurnOptions): AsyncGenerator<NormalizedTurnEvent> {
	const { tripSlug, model } = opts;

	let systemPrompt: string;
	if (tripSlug) {
		const trip = await tripsService.getTrip(tripSlug);
		if (!trip) throw new Error(`Trip "${tripSlug}" not found`);
		systemPrompt = editTripSystemPrompt(trip);
	} else {
		systemPrompt = newTripSystemPrompt();
	}

	// No model → the Claude path's env fallback (ANTHROPIC_MODEL) applies → anthropic.
	const provider = model ? providerOf(model) : 'anthropic';
	if (provider === 'openai') {
		yield* runCodexTurn(opts, systemPrompt);
	} else {
		yield* runClaudeTurn(opts, systemPrompt);
	}
}
