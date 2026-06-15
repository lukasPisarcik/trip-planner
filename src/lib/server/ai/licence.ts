import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderAvailability } from '$lib/schemas';
import { isViewerMode } from '../env.server';

/**
 * Best-effort, server-side detection of whether each provider can actually run.
 *
 * Both providers drive the agent through a locally-installed CLI authenticated
 * by a local login, so "available" means that login exists on disk:
 *  - OpenAI  → the Codex CLI login at `~/.codex/auth.json`.
 *  - Anthropic → the Claude Code login. On Linux this is
 *    `~/.claude/.credentials.json`; on macOS the token lives in the Keychain and
 *    only `~/.claude.json` (config) is on disk, so we accept either as the signal.
 *
 * This is UX only — it lets the picker disable a provider's models up front. The
 * request-time `auth-required` SSE remains the source of truth and corrects any
 * false positive. Not cached, so a fresh `codex login` is picked up on reload.
 */
export function detectProviderAvailability(): ProviderAvailability {
	// The read-only public deployment has no co-pilot — report nothing available.
	if (isViewerMode()) return { anthropic: false, openai: false };
	return { anthropic: detectClaude(), openai: detectCodex() };
}

function detectClaude(): boolean {
	const home = homedir();
	return (
		existsSync(join(home, '.claude', '.credentials.json')) || existsSync(join(home, '.claude.json'))
	);
}

function detectCodex(): boolean {
	return existsSync(join(homedir(), '.codex', 'auth.json'));
}
