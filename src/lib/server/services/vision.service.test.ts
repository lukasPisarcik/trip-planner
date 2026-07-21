import { describe, expect, test } from 'bun:test';
import { analyzeReelVisuals, type RunResult } from './vision.service';

const REEL = 'https://www.tiktok.com/@chef/video/123';

/** A fake command runner that records the commands it was asked to run. */
function recordingRun(reply: (cmd: string[]) => RunResult | Promise<RunResult>) {
	const calls: string[][] = [];
	const run = async (cmd: string[]): Promise<RunResult> => {
		calls.push(cmd);
		return reply(cmd);
	};
	return { run, calls };
}

/** True when cmd looks like a yt-dlp invocation (first arg mentions yt-dlp). */
function isYtDlp(cmd: string[]): boolean {
	return cmd[0].includes('yt-dlp');
}

describe('analyzeReelVisuals', () => {
	test('non-social URL → null, nothing run', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		expect(await analyzeReelVisuals('https://youtube.com/watch?v=1', { run })).toBeNull();
		expect(calls).toHaveLength(0);
	});

	test('garbage URL → null, nothing run', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		expect(await analyzeReelVisuals('not a url', { run })).toBeNull();
		expect(calls).toHaveLength(0);
	});

	test('yt-dlp failure → null, ffmpeg not run', async () => {
		const { run, calls } = recordingRun((cmd) =>
			isYtDlp(cmd) ? { code: 1, stdout: '' } : { code: 0, stdout: '' }
		);
		expect(await analyzeReelVisuals(REEL, { run })).toBeNull();
		expect(calls).toHaveLength(1);
		expect(isYtDlp(calls[0])).toBe(true);
	});

	test('ffmpeg failure → null', async () => {
		const { run, calls } = recordingRun((cmd) =>
			isYtDlp(cmd) ? { code: 0, stdout: '' } : { code: 2, stdout: '' }
		);
		expect(await analyzeReelVisuals(REEL, { run })).toBeNull();
		expect(calls).toHaveLength(2);
	});

	test('download+extract succeed but no frames written → null (before any vision call)', async () => {
		// The fake runner returns success without writing PNGs, so the temp dir is
		// empty — the service must bail before reaching the SDK query.
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		expect(await analyzeReelVisuals(REEL, { run })).toBeNull();
		expect(calls).toHaveLength(2);
		expect(isYtDlp(calls[0])).toBe(true);
		expect(isYtDlp(calls[1])).toBe(false);
	});

	test('runner throwing → null (never throws into the agent path)', async () => {
		const run = async (): Promise<RunResult> => {
			throw new Error('boom');
		};
		expect(await analyzeReelVisuals(REEL, { run })).toBeNull();
	});

	test('honors custom binary paths and passes them into the commands', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		await analyzeReelVisuals(REEL, {
			ytDlpPath: '/opt/yt-dlp',
			ffmpegPath: '/opt/ffmpeg',
			run
		});
		expect(calls[0][0]).toBe('/opt/yt-dlp');
		expect(calls[1][0]).toBe('/opt/ffmpeg');
	});

	test('caps sampled frames via maxFrames (-frames:v)', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		await analyzeReelVisuals(REEL, { maxFrames: 3, run });
		const ffmpeg = calls[1];
		expect(ffmpeg[ffmpeg.indexOf('-frames:v') + 1]).toBe('3');
	});

	test('feeds ffmpeg the same temp file yt-dlp downloaded to', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		await analyzeReelVisuals(REEL, { run });
		const oArg = calls[0][calls[0].indexOf('-o') + 1];
		const iArg = calls[1][calls[1].indexOf('-i') + 1];
		expect(iArg).toBe(oArg);
	});
});
