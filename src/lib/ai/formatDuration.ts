/**
 * Format a millisecond duration as `m:ss` for the run timer (live elapsed while a
 * turn streams, and the persisted "Ran for …" on a settled assistant reply).
 * Negative/NaN inputs clamp to 0 so a clock skew never renders a negative time.
 */
export function formatDuration(ms: number): string {
	const s = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
