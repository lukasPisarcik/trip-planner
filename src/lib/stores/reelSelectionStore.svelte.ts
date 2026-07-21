/**
 * Reel multi-select + the "Build trip" handoff to the co-pilot composer.
 *
 * Two pieces of state:
 *  - `selected` — reel ids currently ticked in the /library grid.
 *  - `pending`  — the ids handed to the composer when the user hits "Build trip".
 *    The composer consumes them once on mount (`takePending()`) and renders them
 *    as attachment chips; the chat route later hydrates their stored text.
 *
 * Class-based runes store (see .claude/docs/svelte-stores.md), exported as a
 * singleton so the /library page and the composer share one instance.
 */
import { MAX_REEL_ATTACHMENTS } from '$lib/schemas';

class ReelSelectionStoreClass {
	selected = $state<string[]>([]);
	pending = $state<string[]>([]);

	get count(): number {
		return this.selected.length;
	}

	/** True once the selection has hit the per-build attachment cap. */
	get atLimit(): boolean {
		return this.selected.length >= MAX_REEL_ATTACHMENTS;
	}

	isSelected(id: string): boolean {
		return this.selected.includes(id);
	}

	/**
	 * Toggle a reel's selection. Adding is capped at MAX_REEL_ATTACHMENTS so a build
	 * never sends a body the chat route would reject with an opaque 400; returns false
	 * when an add was refused because the cap is reached (deselect always succeeds).
	 */
	toggle(id: string): boolean {
		if (this.isSelected(id)) {
			this.selected = this.selected.filter((x) => x !== id);
			return true;
		}
		if (this.atLimit) return false;
		this.selected = [...this.selected, id];
		return true;
	}

	clear(): void {
		this.selected = [];
	}

	/** "Build trip": move the current selection into the pending handoff and clear it. */
	handoff(): void {
		this.pending = [...this.selected];
		this.selected = [];
	}

	/** Composer consumes the pending ids exactly once (drains the handoff). */
	takePending(): string[] {
		const ids = this.pending;
		this.pending = [];
		return ids;
	}
}

export const reelSelectionStore = new ReelSelectionStoreClass();
