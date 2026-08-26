// Direct submodule imports (not the `$lib` barrel) keep this server module loadable
// under plain `bun run` scripts/tests — the barrel pulls in browser-only UI deps.
import { formatZodErrors } from '$lib/helpers/formatZodErrors';
import { log } from '$lib/helpers/logger';
import { z } from 'zod';

/**
 * Server-side environment variables.
 *
 * Add new env vars here so they get validated at boot. Never read
 * `Bun.env` / `process.env` / `$env/*` directly elsewhere — go through
 * `PrivateEnvValue('YOUR_VAR')` so type safety holds.
 */
const PrivateEnvSchema = z.object({
	ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-5'),
	CLAUDE_CODE_PATH: z.string().min(1).optional(),
	// OpenAI/Codex co-pilot. OPENAI_MODEL is the fallback Codex model; CODEX_PATH
	// optionally points at the `codex` CLI binary if it isn't on PATH (mirrors
	// CLAUDE_CODE_PATH). MCP_BRIDGE_SECRET is a bearer token the Codex agent sends
	// to the in-app trip-tools MCP endpoint (/api/mcp/trip-planner); the SDK and the
	// route share it so only this server's Codex subprocess can reach the tools.
	OPENAI_MODEL: z.string().min(1).default('gpt-5-codex'),
	CODEX_PATH: z.string().min(1).optional(),
	MCP_BRIDGE_SECRET: z.string().min(1).optional(),
	// Local reel transcription (the `transcribe_reel` tool). yt-dlp extracts the
	// audio and whisper.cpp transcribes it — all on the owner's machine, no keys.
	// WHISPER_MODEL_PATH points at a ggml model file; when it's unset (fresh checkout
	// or the read-only Vercel deployment) transcription silently no-ops. The two
	// binary paths default to the names on PATH.
	YT_DLP_PATH: z.string().min(1).default('yt-dlp'),
	WHISPER_CLI_PATH: z.string().min(1).default('whisper-cli'),
	WHISPER_MODEL_PATH: z.string().min(1).optional(),
	// Reel vision extraction (`read_post_visuals`). yt-dlp downloads the reel, ffmpeg
	// samples keyframes, and the Claude Code license reads them (no metered API key —
	// same one-shot SDK query the co-pilot uses). Defaults to the name on PATH; vision
	// no-ops gracefully when the binaries or CLI are unavailable.
	FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
	// Agent turn watchdog (see src/lib/server/ai/events.ts). The stall timer aborts a
	// turn only when the SDK stream goes quiet OUTSIDE a tool call (a dead API stream);
	// it is disarmed while a tool executes, so a slow batch of image fetches / web
	// searches no longer trips it. 180s covers a genuinely stalled stream with margin.
	// Coerced from strings since env values are strings.
	AGENT_STALL_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
	// Stall bound BEFORE the first SDK message of a turn. Cold-cache time-to-first-token
	// on a 120K+ prompt plus the SDK's silent 429 retry backoff can legitimately exceed
	// the 180s mid-stream stall; 8 minutes lets a resume survive that without loosening
	// the mid-stream detector (which re-arms at AGENT_STALL_TIMEOUT_MS after the first
	// message arrives).
	AGENT_FIRST_EVENT_TIMEOUT_MS: z.coerce.number().int().positive().default(480_000),
	// Soft cap on total turn runtime and the backstop for a truly hung tool (the stall
	// timer is paused during tool execution). Research-heavy first builds (many web
	// searches + a dozen staged tab/day writes) legitimately run long; 30 minutes gives
	// them room. At this point the Claude runner interrupts gracefully (the session
	// stays resumable); a 30s backstop hard-aborts if the stream still doesn't end.
	AGENT_MAX_TURN_MS: z.coerce.number().int().positive().default(1_800_000),
	// Output-token cap for the spawned Claude Code CLI (CLAUDE_CODE_MAX_OUTPUT_TOKENS).
	// The CLI's own default (32K) truncated a ~50KB tool call mid-JSON; 64K makes a
	// legitimate large call impossible to truncate at realistic payload sizes.
	AGENT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(64_000),
	// Thinking budget per response (the SDK's maxThinkingTokens). Bounds runaway
	// thinking marathons (a 32K-token think that produced 24 characters of text)
	// without cramping normal planning. Note: the SDK marks maxThinkingTokens
	// deprecated and the newest models may treat it as on/off rather than a hard
	// budget — revisit with the `thinking: { budgetTokens }` option if marathons recur.
	AGENT_MAX_THINKING_TOKENS: z.coerce.number().int().positive().default(16_000),
	// Convex deployment URL for server-side reads (SSR + the AI agent) and writes.
	// Same deployment as PUBLIC_CONVEX_URL, which the browser uses for reactive reads.
	CONVEX_URL: z.string().url(),
	// Owner write-secret: the trusted (local) server sends it with every Convex
	// mutation. The public read-only deployment is deliberately NOT given it, so it
	// cannot write. Optional here so that read-only deployment still boots.
	OWNER_WRITE_SECRET: z.string().min(1).optional(),
	// Read-only public deployment switch (e.g. Vercel). When `true`, the app blocks
	// all writes and hides the AI co-pilot. Reads come live from Convex either way.
	// Defaults to off so local development is unaffected.
	VIEWER_MODE: z
		.string()
		.optional()
		.transform((v) => v === 'true'),
	// Shared site password. When set, the handle hook in src/hooks.server.ts gates
	// every page and API/remote request behind a signed session cookie (see
	// src/lib/server/utils/crypto.ts). Unset → the gate is off and the app behaves
	// exactly as before (local dev, existing deployments unaffected).
	SITE_PASSWORD: z.string().min(1).optional()
});

type PrivateEnv = z.infer<typeof PrivateEnvSchema>;

let parsedPrivate: PrivateEnv | null = null;

function getEnv(): PrivateEnv {
	if (parsedPrivate) return parsedPrivate;

	// `process.env` works on both Bun and Node (Vercel's serverless runtime),
	// where the `Bun` global is undefined. This is the single sanctioned place
	// to read raw env — everything else goes through `PrivateEnvValue`.
	const { success, data, error: err } = PrivateEnvSchema.safeParse(process.env);
	if (!success) {
		const message = 'Invalid private environment variables';
		const errorId = crypto.randomUUID();
		log.error({ errorId, validationError: formatZodErrors(err) }, message);
		throw new Error(`${message}: ${formatZodErrors(err)}`);
	}
	parsedPrivate = data;
	return parsedPrivate;
}

export function PrivateEnvValue<K extends keyof PrivateEnv>(key: K): PrivateEnv[K] {
	return getEnv()[key];
}

/** True when running as a read-only public deployment (`VIEWER_MODE=true`). */
export function isViewerMode(): boolean {
	return PrivateEnvValue('VIEWER_MODE');
}

/** True when the shared-password site gate is armed (`SITE_PASSWORD` set). */
export function isSiteGated(): boolean {
	return !!PrivateEnvValue('SITE_PASSWORD');
}

/**
 * Full environment for a spawned agent subprocess (PATH, CLI credentials, …)
 * plus caller overrides. The single sanctioned pass-through of the raw process
 * env outside schema validation (hard rule 2) — callers must not read
 * individual variables from the result; declared vars go through
 * `PrivateEnvValue` as usual.
 */
export function subprocessEnv(
	overrides: Record<string, string>
): Record<string, string | undefined> {
	return { ...process.env, ...overrides };
}
