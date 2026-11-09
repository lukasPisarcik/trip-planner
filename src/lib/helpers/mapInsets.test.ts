import { describe, expect, test } from 'bun:test';
import { overlayInsets, fitPadding, type OverlayLayout } from './mapInsets';

const desktop: OverlayLayout = {
	desktop: true,
	headerHeight: 56,
	titleHeight: 44,
	sidebarWidth: 256,
	panelWidth: 440,
	panelHidden: false,
	sheetHeight: 0,
	aiPanelWidth: 0,
	gap: 12
};

describe('overlayInsets', () => {
	test('desktop, expanded sidebar: header + title on top, sidebar left, panel right', () => {
		expect(overlayInsets(desktop)).toEqual({ top: 124, right: 452, bottom: 0, left: 256 });
	});

	test('icon rail narrows the left inset', () => {
		expect(overlayInsets({ ...desktop, sidebarWidth: 48 }).left).toBe(48);
	});

	test('hidden panel frees the right edge', () => {
		expect(overlayInsets({ ...desktop, panelHidden: true }).right).toBe(0);
	});

	test('open AI panel adds its width to the right inset', () => {
		expect(overlayInsets({ ...desktop, aiPanelWidth: 392 }).right).toBe(844);
	});

	test('phone: bottom sheet covers the bottom, nothing left or right', () => {
		const phone = overlayInsets({ ...desktop, desktop: false, sidebarWidth: 0, sheetHeight: 464 });
		expect(phone).toEqual({ top: 124, right: 0, bottom: 476, left: 0 });
	});

	test('phone with the sheet hidden has no bottom inset', () => {
		const phone = overlayInsets({
			...desktop,
			desktop: false,
			sidebarWidth: 0,
			sheetHeight: 464,
			panelHidden: true
		});
		expect(phone.bottom).toBe(0);
	});

	test('unmeasured title pads only header + gap', () => {
		expect(overlayInsets({ ...desktop, titleHeight: 0 }).top).toBe(68);
	});
});

describe('fitPadding', () => {
	const insets = { top: 124, right: 452, bottom: 0, left: 256 };

	test('adds the base to every side on a wide canvas', () => {
		expect(fitPadding(insets, 48, { width: 1440, height: 900 })).toEqual({
			top: 172,
			right: 500,
			bottom: 48,
			left: 304
		});
	});

	test('leaves a canvas alone when the free band is exactly the minimum', () => {
		// left 304 + right 500 = 804 → 924px wide leaves exactly 120px.
		const p = fitPadding(insets, 48, { width: 924, height: 900 });
		expect(p.left).toBe(304);
		expect(p.right).toBe(500);
	});

	test('clamps a small canvas to a ≥120px band per axis, preserving the side ratio', () => {
		const p = fitPadding(insets, 48, { width: 390, height: 600 });
		expect(390 - p.left - p.right).toBeGreaterThanOrEqual(120);
		expect(600 - p.top - p.bottom).toBeGreaterThanOrEqual(120);
		// Width axis: 304:500 before, scaled by the same factor.
		expect(p.left / p.right).toBeCloseTo(304 / 500, 1);
		// Height axis (172 + 48 = 220 ≤ 480 free) is untouched.
		expect(p.top).toBe(172);
		expect(p.bottom).toBe(48);
	});

	test('never returns negative padding', () => {
		const p = fitPadding(insets, 56, { width: 100, height: 100 });
		for (const v of Object.values(p)) expect(v).toBeGreaterThanOrEqual(0);
	});

	test('zero insets with zero base stay zero', () => {
		expect(
			fitPadding({ top: 0, right: 0, bottom: 0, left: 0 }, 0, { width: 10, height: 10 })
		).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
	});
});
