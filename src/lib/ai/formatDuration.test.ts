import { describe, expect, test } from 'bun:test';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
	test('formats sub-minute durations as 0:ss with zero-padding', () => {
		expect(formatDuration(0)).toBe('0:00');
		expect(formatDuration(1_000)).toBe('0:01');
		expect(formatDuration(9_000)).toBe('0:09');
		expect(formatDuration(59_000)).toBe('0:59');
	});

	test('rolls over into minutes', () => {
		expect(formatDuration(60_000)).toBe('1:00');
		expect(formatDuration(90_000)).toBe('1:30');
		expect(formatDuration(600_000)).toBe('10:00');
	});

	test('rounds to the nearest second', () => {
		expect(formatDuration(1_400)).toBe('0:01');
		expect(formatDuration(1_600)).toBe('0:02');
		// 59.6s rounds up to 60s → rolls into 1:00.
		expect(formatDuration(59_600)).toBe('1:00');
	});

	test('clamps negative and non-finite inputs to 0:00', () => {
		expect(formatDuration(-5_000)).toBe('0:00');
		expect(formatDuration(NaN)).toBe('0:00');
		expect(formatDuration(Infinity)).toBe('0:00');
	});
});
