import type { ChatProvider } from '$lib/schemas';

/**
 * Provider-neutral turn events. Both runners (Claude Code SDK, Codex SDK) translate
 * their native stream into this union; the chat route (`/api/ai/chat`) consumes only
 * this union and maps it to SSE. Tool names are already MCP-prefix-stripped to their
 * bare form (e.g. `create_trip`), so the route's `ask_user` / `create_trip` /
 * `formatTool` handling works the same regardless of provider.
 */
export type NormalizedTurnEvent =
	| { type: 'thinking-start' }
	| { type: 'thinking-delta'; delta: string }
	| { type: 'thinking-stop' }
	| { type: 'text-start' }
	| { type: 'text-delta'; delta: string }
	// A tool call was dispatched (input may not be known yet) — drives the "working" chip.
	| { type: 'tool-pending'; id: string; name: string }
	// A tool call with its resolved input.
	| { type: 'tool-call'; id: string; name: string; input: unknown }
	| { type: 'tool-result'; id: string; isError: boolean }
	// Context footprint: `used` tokens of `total` window. `total` 0 → gauge hidden.
	| { type: 'usage'; used: number; total: number }
	// The provider's local CLI isn't signed in.
	| { type: 'auth-required' }
	// The turn ended in a provider-side error (e.g. max turns).
	| { type: 'turn-error'; subtype: string }
	// The provider's native session/thread id, for resume (Codex mints its own).
	| { type: 'thread-id'; provider: ChatProvider; id: string };

/** Thrown when the turn watchdog aborts a stalled or over-long agent turn. */
export class AgentTimeoutError extends Error {
	constructor(public readonly reason: 'stall' | 'max') {
		super(`Agent turn aborted (${reason} timeout)`);
		this.name = 'AgentTimeoutError';
	}
}

export interface TurnWatchdog {
	/** Aborts on client disconnect, stall, or max-runtime. Pass to the provider SDK. */
	ctrl: AbortController;
	/** Call on every inbound message to reset the stall timer. */
	resetStall: () => void;
	/** A tool call started executing — disarm the stall timer while it runs. */
	enterTool: (id: string) => void;
	/** A tool call's result arrived — re-arm the stall timer once none are in flight. */
	exitTool: (id: string) => void;
	/** Clear both timers (call in a `finally`). */
	cleanup: () => void;
	/** Which timeout (if any) fired — used to throw AgentTimeoutError. */
	timedOut: () => 'stall' | 'max' | null;
}

/**
 * One AbortController drives the external signal (client disconnect / stop button),
 * a stall timer (no SDK message for `stallMs`), and a max-runtime timer. Without this
 * a stalled API stream hangs forever and orphans the CLI subprocess. Shared by both
 * provider runners.
 *
 * The stall timer catches a dead API stream — but between a tool-call and its result
 * the SDK emits nothing while the tool (a web search, a batch of image fetches) is
 * genuinely working, which on a slow connection can exceed any fixed stall bound.
 * So the stall timer is *disarmed* while any tool is in flight (`enterTool`/`exitTool`);
 * the max-runtime timer stays the backstop — a truly hung tool, or a crashed
 * subprocess that ends the stream, is still caught.
 */
export function createTurnWatchdog(
	signal: AbortSignal | undefined,
	stallMs: number,
	maxMs: number
): TurnWatchdog {
	const ctrl = new AbortController();
	if (signal) {
		if (signal.aborted) ctrl.abort();
		else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
	}

	let timedOut: 'stall' | 'max' | null = null;
	let stallTimer: ReturnType<typeof setTimeout> | undefined;
	// Tool calls currently executing (keyed by id, so the pending→call double-signal
	// and parallel tool calls are both correct). Non-empty → the stall timer is off.
	const inflight = new Set<string>();

	const resetStall = () => {
		clearTimeout(stallTimer);
		// A tool is running → the max timer is the only bound; don't re-arm the stall.
		if (inflight.size > 0) return;
		stallTimer = setTimeout(() => {
			timedOut = 'stall';
			ctrl.abort();
		}, stallMs);
	};
	const enterTool = (id: string) => {
		inflight.add(id);
		clearTimeout(stallTimer);
	};
	const exitTool = (id: string) => {
		inflight.delete(id);
		if (inflight.size === 0) resetStall();
	};
	const maxTimer = setTimeout(() => {
		timedOut = 'max';
		ctrl.abort();
	}, maxMs);

	return {
		ctrl,
		resetStall,
		enterTool,
		exitTool,
		cleanup: () => {
			clearTimeout(stallTimer);
			clearTimeout(maxTimer);
		},
		timedOut: () => timedOut
	};
}
