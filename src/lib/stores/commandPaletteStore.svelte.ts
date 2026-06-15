/**
 * Global state for the ⌘K / Ctrl-K command palette. A singleton so any surface
 * (the header search button, a keyboard shortcut, the sidebar) can open it.
 */
class CommandPaletteStoreClass {
	open = $state(false);

	toggle(): void {
		this.open = !this.open;
	}

	set(value: boolean): void {
		this.open = value;
	}
}

export const commandPaletteStore = new CommandPaletteStoreClass();
