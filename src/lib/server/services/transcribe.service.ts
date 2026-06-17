import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { detectPlatform } from './social.service';

// Transcribes the spoken voiceover of a TikTok / Instagram reel — the highest-value
// signal in a travel reel (it names the places). Runs entirely locally and free:
// `yt-dlp` extracts the audio as 16 kHz mono WAV, then `whisper.cpp` (`whisper-cli`)
// transcribes it to plain text on stdout.
//
// Best-effort and dependency-light (no env/logger import, so it stays runnable under
// `bun test`): callers pass the binary/model paths in, the spawn is injectable, and
// every failure path (not configured, missing binary, private video, timeout) returns
// null instead of throwing. When the model path is unset — a fresh checkout or the
// read-only Vercel deployment — transcription silently no-ops.

const DEFAULT_TIMEOUT_MS = 120_000;
// A transcript bigger than this is almost certainly noise; cap it so it doesn't
// blow up the agent's context.
const MAX_TRANSCRIPT = 4000;

export interface RunResult {
	code: number;
	stdout: string;
}

/** Runs a command and resolves its exit code + captured stdout. Injectable for tests. */
export type CommandRunner = (cmd: string[]) => Promise<RunResult>;

export interface TranscribeOptions {
	/** Path to the yt-dlp binary (default `yt-dlp`, resolved on PATH). */
	ytDlpPath?: string;
	/** Path to the whisper.cpp CLI (default `whisper-cli`, resolved on PATH). */
	whisperCliPath?: string;
	/** Path to a ggml whisper model. When unset, transcription is skipped (returns null). */
	modelPath?: string;
	/** Override the command runner (tests inject a fake). */
	run?: CommandRunner;
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

/**
 * Download + transcribe a reel's audio. Returns the transcript text, or null when
 * transcription isn't configured/available or anything fails. Only TikTok/Instagram
 * URLs are accepted (guards yt-dlp against being pointed at arbitrary hosts).
 */
export async function transcribeReel(
	rawUrl: string,
	opts: TranscribeOptions = {}
): Promise<string | null> {
	const modelPath = opts.modelPath;
	if (!modelPath) return null; // not configured → graceful no-op
	if (!detectPlatform(rawUrl)) return null;

	const ytDlp = opts.ytDlpPath || 'yt-dlp';
	const whisper = opts.whisperCliPath || 'whisper-cli';
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const run = opts.run ?? ((cmd) => spawnRun(cmd, timeoutMs));

	const base = join(tmpdir(), `reel-${crypto.randomUUID()}`);
	const wav = `${base}.wav`;
	try {
		const dl = await run([
			ytDlp,
			'-x',
			'--audio-format',
			'wav',
			'--postprocessor-args',
			'ffmpeg:-ar 16000 -ac 1',
			'--no-playlist',
			'-o',
			`${base}.%(ext)s`,
			rawUrl.trim()
		]);
		if (dl.code !== 0) return null;

		const tr = await run([whisper, '-m', modelPath, '-f', wav, '-nt']);
		if (tr.code !== 0) return null;

		const text = tr.stdout.replace(/\s+/g, ' ').trim();
		if (!text) return null;
		return text.length > MAX_TRANSCRIPT ? text.slice(0, MAX_TRANSCRIPT).trimEnd() + '…' : text;
	} catch {
		return null;
	} finally {
		// yt-dlp wrote the temp WAV; clean it up. Best-effort (may not exist on failure).
		await unlink(wav).catch(() => {});
	}
}
