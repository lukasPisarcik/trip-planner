import { formatZodErrors, log } from '$lib';
import { z } from 'zod';

/**
 * Server-side environment variables.
 *
 * Add new env vars here so they get validated at boot. Never read
 * `Bun.env` / `process.env` / `$env/*` directly elsewhere — go through
 * `PrivateEnvValue('YOUR_VAR')` so type safety holds.
 */
const PrivateEnvSchema = z.object({
	ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-4-6'),
	CLAUDE_CODE_PATH: z.string().min(1).optional(),
	// Agent turn watchdog (see src/lib/server/ai/agent.ts). A turn is aborted if
	// the SDK emits no message for STALL ms (a stalled API stream), or if total
	// runtime exceeds MAX ms. Coerced from strings since env values are strings.
	AGENT_STALL_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
	// Research-heavy first builds (many web searches + several itinerary writes)
	// legitimately run past 5 minutes; 300s was aborting them mid-build before
	// `create_trip` ever fired. 10 minutes gives them room to finish.
	AGENT_MAX_TURN_MS: z.coerce.number().int().positive().default(600_000),
	// Read-only public deployment switch (e.g. Vercel). When `true`, the app
	// serves trips from the committed snapshot, blocks all writes, and hides
	// the AI co-pilot. Defaults to off so local development is unaffected.
	VIEWER_MODE: z
		.string()
		.optional()
		.transform((v) => v === 'true')
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
