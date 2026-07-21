import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { detectPlatform } from './social.service';
import { VisualExtractionSchema, type VisualExtraction } from '$lib/schemas';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

// Reads what a TikTok / Instagram reel *shows* rather than what it says. Many
// travel/food reels carry their value on-screen — burned-in text (menu prices,
// restaurant names, "save this"), signage, and dish/venue footage — under a thin
// caption and with no spoken narration. When `extract_social_post` and
// `transcribe_reel` come back empty, this vision pass fills the gap: `yt-dlp`
// downloads the clip, `ffmpeg` samples a handful of keyframes, and a one-shot
// Claude-vision query reads the frames into `{ onScreenText, visualDescription }`.
//
// Same shape as transcribe.service: dependency-light (no env/logger import so it
// stays runnable under `bun test`), an injectable CommandRunner for the binaries,
// a per-command kill-timer, the shared `detectPlatform` SSRF guard, and every
// failure path (wrong host, missing binaries/CLI, no frames, bad JSON, timeout)
// returns null instead of throwing into the agent. The Claude query reuses the
// Claude Code license (`pathToClaudeCodeExecutable`) — no metered API key — and
// is dynamically imported so the SDK never loads on the non-vision test paths.

const DEFAULT_TIMEOUT_MS = 120_000;
// Sample at most this many keyframes; enough to read menus/signage without
// bloating the vision prompt (and the token bill).
const DEFAULT_MAX_FRAMES = 5;
// Cap each extracted field so a runaway reply doesn't blow up the agent's context.
const MAX_FIELD = 4000;

export interface RunResult {
	code: number;
	stdout: string;
}

/** Runs a command and resolves its exit code + captured stdout. Injectable for tests. */
export type CommandRunner = (cmd: string[]) => Promise<RunResult>;

export interface VisionOptions {
	/** Path to the yt-dlp binary (default `yt-dlp`, resolved on PATH). */
	ytDlpPath?: string;
	/** Path to the ffmpeg binary (default `ffmpeg`, resolved on PATH). */
	ffmpegPath?: string;
	/** Path to the Claude Code executable the vision query authenticates through. */
	claudeCodePath?: string;
	/** Model id for the vision query (defaults to the SDK's default). */
	model?: string;
	/** Override the command runner (tests inject a fake). */
	run?: CommandRunner;
	/** Cap on sampled keyframes (default 5). */
	maxFrames?: number;
	/** Per-command timeout in ms (default 120s). */
	timeoutMs?: number;
}

/** Real command runner backed by Bun.spawn, with a kill-timer per process. */
async function spawnRun(cmd: string[], timeoutMs: number): Promise<RunResult> {
	const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'ignore' });
	const timer = setTimeout(() => proc.kill(), timeoutMs);
	try {
		const stdout = await new Response(proc.stdout).text();
		const code = await proc.exited;
		return { code, stdout };
	} finally {
		clearTimeout(timer);
	}
}

/** Strip an optional ```json … ``` fence and parse the first JSON object in the text. */
function parseJsonReply(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const body = (fenced ? fenced[1] : text).trim();
	const start = body.indexOf('{');
	const end = body.lastIndexOf('}');
	if (start === -1 || end === -1 || end < start) return null;
	try {
		return JSON.parse(body.slice(start, end + 1));
	} catch {
		return null;
	}
}

/** Trim, collapse whitespace, and cap a model-produced field. */
function capField(value: string): string {
	const cleaned = value.replace(/\s+/g, ' ').trim();
	return cleaned.length > MAX_FIELD ? cleaned.slice(0, MAX_FIELD).trimEnd() + '…' : cleaned;
}

/**
 * The strict instruction the vision model answers. We disable all tools/MCP and
 * ask for a single JSON object so the reply parses deterministically.
 */
const VISION_PROMPT =
	'These are keyframes sampled from a short travel/food social-media reel. Read them as a ' +
	'visual document. Return ONLY a single JSON object (no prose, no code fence) of the shape ' +
	'{"onScreenText": string, "visualDescription": string}. `onScreenText` = every readable ' +
	'word burned into the frames verbatim (captions, menus, prices, signage, place names, ' +
	'"save this" overlays), joined with " | "; empty string if none. `visualDescription` = a ' +
	'concise description of what is shown — venues, dishes, streets, landmarks — naming any ' +
	'identifiable place. Do not invent text or places you cannot actually see.';

/**
 * Download a reel, sample keyframes, and read them with a one-shot Claude-vision
 * query. Returns `{ onScreenText, visualDescription }`, or null when vision isn't
 * available or anything fails. Only TikTok/Instagram URLs are accepted (guards
 * yt-dlp against arbitrary hosts).
 */
export async function analyzeReelVisuals(
	rawUrl: string,
	opts: VisionOptions = {}
): Promise<VisualExtraction | null> {
	if (!detectPlatform(rawUrl)) return null; // wrong host → graceful no-op

	const ytDlp = opts.ytDlpPath || 'yt-dlp';
	const ffmpeg = opts.ffmpegPath || 'ffmpeg';
	const maxFrames = opts.maxFrames ?? DEFAULT_MAX_FRAMES;
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const run = opts.run ?? ((cmd) => spawnRun(cmd, timeoutMs));

	const dir = join(tmpdir(), `reel-vision-${crypto.randomUUID()}`);
	const video = join(dir, 'clip.mp4');
	try {
		await mkdir(dir, { recursive: true });

		const dl = await run([ytDlp, '-f', 'mp4/best', '--no-playlist', '-o', video, rawUrl.trim()]);
		if (dl.code !== 0) return null;

		// `thumbnail` picks representative frames; -frames:v caps the count; the
		// scale keeps each PNG small so the base64 payload stays cheap.
		const ex = await run([
			ffmpeg,
			'-y',
			'-i',
			video,
			'-vf',
			'thumbnail,scale=512:-1',
			'-frames:v',
			String(maxFrames),
			'-vsync',
			'vfr',
			join(dir, 'frame-%03d.png')
		]);
		if (ex.code !== 0) return null;

		const files = (await readdir(dir))
			.filter((f) => f.endsWith('.png'))
			.sort()
			.slice(0, maxFrames);
		if (files.length === 0) return null; // nothing to look at → give up

		const frames = await Promise.all(files.map((f) => readFile(join(dir, f))));

		// Streaming-input prompt: one user message carrying the instruction plus the
		// frames as inline base64 image blocks. MessageParam's content array accepts
		// ImageBlockParam { source: base64 }, so no re-download or temp path juggling.
		// (If a future SDK only took file paths, the PNGs are already on disk in `dir`.)
		const message: SDKUserMessage = {
			type: 'user',
			parent_tool_use_id: null,
			message: {
				role: 'user',
				content: [
					{ type: 'text', text: VISION_PROMPT },
					...frames.map((buf) => ({
						type: 'image' as const,
						source: {
							type: 'base64' as const,
							media_type: 'image/png' as const,
							data: buf.toString('base64')
						}
					}))
				]
			}
		};
		async function* input(): AsyncGenerator<SDKUserMessage> {
			yield message;
		}

		// Dynamic import so the SDK only loads on the real vision path (never under
		// `bun test`, which exercises only the guard/download/frame paths above).
		const { query } = await import('@anthropic-ai/claude-agent-sdk');
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		let reply = '';
		try {
			const q = query({
				prompt: input(),
				options: {
					...(opts.model ? { model: opts.model } : {}),
					// Pure one-shot vision: no MCP, no tools, isolated from host config.
					settingSources: [],
					strictMcpConfig: true,
					allowedTools: [],
					disallowedTools: [
						'Bash',
						'Read',
						'Write',
						'Edit',
						'NotebookEdit',
						'WebSearch',
						'WebFetch'
					],
					...(opts.claudeCodePath ? { pathToClaudeCodeExecutable: opts.claudeCodePath } : {}),
					abortController: ctrl
				}
			});
			for await (const msg of q) {
				if (msg.type === 'result') {
					if (msg.subtype === 'success') reply = msg.result;
					break;
				}
			}
		} finally {
			clearTimeout(timer);
			ctrl.abort();
		}

		const parsed = VisualExtractionSchema.safeParse(parseJsonReply(reply));
		if (!parsed.success) return null;
		const onScreenText = capField(parsed.data.onScreenText);
		const visualDescription = capField(parsed.data.visualDescription);
		if (!onScreenText && !visualDescription) return null; // vision saw nothing usable
		return { onScreenText, visualDescription };
	} catch {
		return null;
	} finally {
		// Best-effort: remove the whole temp working dir (video + frames).
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
}
