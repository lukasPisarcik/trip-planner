/**
 * Pure geometry for the map-first trip layout: how much of the fixed, full-
 * viewport map canvas is covered by UI chrome, and the fitBounds padding that
 * keeps fitted markers out from under it. No Maps types — runs in Bun tests.
 */

export interface MapInsets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface OverlayLayout {
	/** ≥ 768px: the content panel is docked right; otherwise it is a bottom sheet. */
	desktop: boolean;
	/** The app header the fixed canvas runs under (56 — h-14). */
	headerHeight: number;
	/** Measured height of the glass title card; 0 until measured. */
	titleHeight: number;
	/** 256 expanded · 48 icon rail · 0 on phones (the sidebar is a sheet there). */
	sidebarWidth: number;
	/** 440 (≥ 1280px) · 400 (768–1279px). */
	panelWidth: number;
	/** The panel/sheet is slid off-screen. */
	panelHidden: boolean;
	/** Px of the phone bottom sheet (55% of innerHeight). */
	sheetHeight: number;
	/** 392 (380 card + 12 gap) while the AI panel is open at ≥ 1024px, else 0. */
	aiPanelWidth: number;
	/** The inset of every floating card (12). */
	gap: number;
}

/** Px of each canvas edge covered by UI chrome. */
export function overlayInsets(l: OverlayLayout): MapInsets {
	const top = l.headerHeight + l.gap + l.titleHeight + (l.titleHeight ? l.gap : 0);
	if (l.desktop) {
		return {
			top,
			right: l.aiPanelWidth + (l.panelHidden ? 0 : l.panelWidth + l.gap),
			bottom: 0,
			left: l.sidebarWidth
		};
	}
	return { top, right: 0, bottom: l.panelHidden ? 0 : l.sheetHeight + l.gap, left: 0 };
}

/**
 * fitBounds padding = insets + base, clamped so at least `minBand` px stay free
 * on each axis (padding beyond the canvas makes fitBounds degenerate). When an
 * axis has to shrink, both sides scale by the same factor so their ratio holds.
 */
export function fitPadding(
	insets: MapInsets,
	base: number,
	canvas: { width: number; height: number },
	minBand = 120
): MapInsets {
	const p = {
		top: insets.top + base,
		right: insets.right + base,
		bottom: insets.bottom + base,
		left: insets.left + base
	};
	const squeeze = (a: number, b: number, size: number): [number, number] => {
		const free = size - a - b;
		if (free >= minBand || a + b === 0) return [a, b];
		const k = Math.max(0, size - minBand) / (a + b);
		return [Math.floor(a * k), Math.floor(b * k)];
	};
	[p.left, p.right] = squeeze(p.left, p.right, canvas.width);
	[p.top, p.bottom] = squeeze(p.top, p.bottom, canvas.height);
	return p;
}
