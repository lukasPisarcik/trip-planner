import { browser } from '$app/environment';
import {
	ChatModelSchema,
	DEFAULT_CHAT_MODEL,
	defaultModelForProvider,
	providerOf,
	type ChatModel,
	type ChatProvider,
	type ProviderAvailability
} from '$lib/schemas';

const STORAGE_KEY = 'chat:model';

// Selected AI model for the co-pilot, persisted across reloads. Mirrors the
// themeStore/aiPanelStore pattern. The model carries its own provider (Anthropic
// or OpenAI/Codex); `availability` tracks which providers have a detected local
// licence so the store never strands `current` on a provider that can't run.
class ModelStoreClass {
	current = $state<ChatModel>(DEFAULT_CHAT_MODEL);
	/** True once the user explicitly picks a model — until then new trips default
	 * to the highest-quality model regardless of `current`. */
	pickedByUser = $state(false);
	/** Detected provider licences. Defaults to both-true so the picker isn't
	 * disabled before the layout supplies real availability. */
	availability = $state<ProviderAvailability>({ anthropic: true, openai: true });

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

	/** Apply detected provider availability; if `current`'s provider has no licence,
	 * fall back to a licensed provider's default so the composer stays usable. */
	applyAvailability(availability: ProviderAvailability): void {
		this.availability = availability;
		if (!availability[providerOf(this.current)]) {
			const fallback = this.firstAvailableProvider();
			if (fallback) {
				this.current = defaultModelForProvider(fallback);
				this.pickedByUser = false;
			}
		}
	}

	isAvailable(model: ChatModel): boolean {
		return this.availability[providerOf(model)];
	}

	firstAvailableProvider(): ChatProvider | null {
		if (this.availability.anthropic) return 'anthropic';
		if (this.availability.openai) return 'openai';
		return null;
	}

	/** True when at least one provider has a detected licence (else send is blocked). */
	get hasAnyProvider(): boolean {
		return this.availability.anthropic || this.availability.openai;
	}

	set(value: ChatModel): void {
		const { success, data } = ChatModelSchema.safeParse(value);
		if (!success) return;
		// Don't let an unlicensed provider's model be selected.
		if (!this.isAvailable(data)) return;
		this.current = data;
		this.pickedByUser = true;
		if (browser) localStorage.setItem(STORAGE_KEY, data);
	}

	/** Model to use for a turn: new trips prefer Opus until the user overrides
	 * (only if Anthropic is licensed); edits follow the current selection. */
	forMode(mode: 'new-trip' | 'edit-trip'): ChatModel {
		if (mode === 'new-trip' && !this.pickedByUser && this.availability.anthropic) {
			return 'claude-opus-4-8';
		}
		return this.current;
	}
}

export const modelStore = new ModelStoreClass();
