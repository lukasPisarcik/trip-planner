import { describe, expect, test } from 'bun:test';
import { transcribeReel, type RunResult } from './transcribe.service';

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

describe('transcribeReel', () => {
	test('downloads then transcribes, returning whitespace-normalized text', async () => {
		const { run, calls } = recordingRun((cmd) =>
			cmd[0] === 'yt-dlp'
				? { code: 0, stdout: '' }
				: { code: 0, stdout: '  Sunset   at\nKazbegi.  ' }
		);
		const out = await transcribeReel(REEL, { modelPath: '/models/ggml.bin', run });
		expect(out).toBe('Sunset at Kazbegi.');

		expect(calls).toHaveLength(2);
		expect(calls[0][0]).toBe('yt-dlp');
		expect(calls[1][0]).toBe('whisper-cli');
		// whisper's -f wav must be the same temp base yt-dlp wrote to with -o.
		const oArg = calls[0][calls[0].indexOf('-o') + 1];
		const fArg = calls[1][calls[1].indexOf('-f') + 1];
		expect(oArg.replace('.%(ext)s', '')).toBe(fArg.replace(/\.wav$/, ''));
	});

	test('passes the model path through to whisper', async () => {
		const { run, calls } = recordingRun((cmd) =>
			cmd[0] === 'yt-dlp' ? { code: 0, stdout: '' } : { code: 0, stdout: 'hi' }
		);
		await transcribeReel(REEL, { modelPath: '/models/ggml.bin', run });
		expect(calls[1][calls[1].indexOf('-m') + 1]).toBe('/models/ggml.bin');
	});

	test('no model path configured → null, nothing run', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		expect(await transcribeReel(REEL, { run })).toBeNull();
		expect(calls).toHaveLength(0);
	});

	test('non-social URL → null, nothing run', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: '' }));
		expect(
			await transcribeReel('https://youtube.com/watch?v=1', { modelPath: '/m.bin', run })
		).toBeNull();
		expect(calls).toHaveLength(0);
	});

	test('yt-dlp failure → null, whisper not run', async () => {
		const { run, calls } = recordingRun((cmd) =>
			cmd[0] === 'yt-dlp' ? { code: 1, stdout: '' } : { code: 0, stdout: 'x' }
		);
		expect(await transcribeReel(REEL, { modelPath: '/m.bin', run })).toBeNull();
		expect(calls).toHaveLength(1);
	});

	test('whisper failure → null', async () => {
		const { run } = recordingRun((cmd) =>
			cmd[0] === 'whisper-cli' ? { code: 2, stdout: 'partial' } : { code: 0, stdout: '' }
		);
		expect(await transcribeReel(REEL, { modelPath: '/m.bin', run })).toBeNull();
	});

	test('empty transcript → null', async () => {
		const { run } = recordingRun((cmd) =>
			cmd[0] === 'whisper-cli' ? { code: 0, stdout: '   \n  ' } : { code: 0, stdout: '' }
		);
		expect(await transcribeReel(REEL, { modelPath: '/m.bin', run })).toBeNull();
	});

	test('runner throwing → null (never throws into the agent path)', async () => {
		const run = async (): Promise<RunResult> => {
			throw new Error('boom');
		};
		expect(await transcribeReel(REEL, { modelPath: '/m.bin', run })).toBeNull();
	});

	test('honors custom binary paths', async () => {
		const { run, calls } = recordingRun(() => ({ code: 0, stdout: 'ok' }));
		await transcribeReel(REEL, {
			modelPath: '/m.bin',
			ytDlpPath: '/opt/yt-dlp',
			whisperCliPath: '/opt/whisper',
			run
		});
		expect(calls[0][0]).toBe('/opt/yt-dlp');
		expect(calls[1][0]).toBe('/opt/whisper');
	});
});
