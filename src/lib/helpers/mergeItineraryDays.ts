/**
 * Merge `incoming` itinerary days into `existing`, keyed by day `number`:
 * a matching key is replaced in place, new keys are appended. Keys compare
 * numerically when the whole value parses as a number ('2' matches 2), else by
 * exact string ('2–4' only matches '2–4'; empty/whitespace never matches 0).
 *
 * Ordering: when every day has a finite LEADING number ('2–4' → 2), the result
 * is stable-sorted by it — so range-numbered days from existing trips sort
 * correctly; otherwise arrival order is preserved.
 *
 * Pure and dependency-free: shared by the trips service and the Convex
 * `upsertItineraryDays` mutation (where the read-merge-write is transactional).
 */
export function mergeItineraryDays<T extends { number: string | number }>(
	existing: T[],
	incoming: T[]
): T[] {
	const keyOf = (n: string | number): string => {
		const s = String(n).trim();
		if (s === '') return String(n); // Number('') is 0 — never collide '' with day 0
		const num = Number(s);
		return Number.isFinite(num) ? String(num) : String(n);
	};
	const merged = [...existing];
	for (const day of incoming) {
		const idx = merged.findIndex((d) => keyOf(d.number) === keyOf(day.number));
		if (idx >= 0) merged[idx] = day;
		else merged.push(day);
	}
	const leading = (n: string | number): number => parseFloat(String(n).trim());
	const sortable = merged.every((d) => Number.isFinite(leading(d.number)));
	// Array.prototype.sort is stable, so equal leading numbers keep arrival order.
	return sortable ? merged.sort((a, b) => leading(a.number) - leading(b.number)) : merged;
}
