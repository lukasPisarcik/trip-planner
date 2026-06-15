import { browser } from '$app/environment';
import { ChatModelSchema, DEFAULT_CHAT_MODEL, type ChatModel } from '$lib/schemas';

const STORAGE_KEY = 'chat:model';

// Selected Claude model for the AI co-pilot, persisted across reloads. Mirrors
// the themeStore/aiPanelStore pattern. Vendor-agnostic shape in spirit, but the
// Claude Agent SDK is Claude-only for now.
class ModelStoreClass {
	current = $state<ChatModel>(DEFAULT_CHAT_MODEL);
	/** True once the user explicitly picks a model — until then new trips default
	 * to the highest-quality model regardless of `current`. */
	pickedByUser = $state(false);

	init(): void {
		if (!browser) return;
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return;
		const { success, data } = ChatModelSchema.safeParse(stored);
		if (success) {
			this.current = data;
			this.pickedByUser = true;
		}
	}

	set(value: ChatModel): void {
		const { success, data } = ChatModelSchema.safeParse(value);
		if (!success) return;
		this.current = data;
		this.pickedByUser = true;
		if (browser) localStorage.setItem(STORAGE_KEY, data);
	}

	/** Model to use for a turn: new trips prefer Opus until the user overrides;
	 * edits follow the current selection. */
	forMode(mode: 'new-trip' | 'edit-trip'): ChatModel {
		if (mode === 'new-trip' && !this.pickedByUser) return 'claude-opus-4-8';
		return this.current;
	}
}

export const modelStore = new ModelStoreClass();
