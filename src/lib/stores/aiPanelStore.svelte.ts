import { browser } from '$app/environment';

class AiPanelStoreClass {
	open = $state(false);

	init(): void {
		if (!browser) return;
		const stored = localStorage.getItem('aiPanel:open');
		if (stored === '1') this.open = true;
	}

	toggle(): void {
		this.open = !this.open;
		if (browser) localStorage.setItem('aiPanel:open', this.open ? '1' : '0');
	}

	set(value: boolean): void {
		this.open = value;
		if (browser) localStorage.setItem('aiPanel:open', value ? '1' : '0');
	}
}

export const aiPanelStore = new AiPanelStoreClass();
