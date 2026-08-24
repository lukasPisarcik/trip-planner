// Google Maps deep-link builder. Pure and DOM-free so it's Bun-testable and
// usable from cards, info windows, and prompts alike. Plain Maps URLs are
// single-pin only — the whole-trip hand-off is the KML export (see kml.ts).

import type { Coords } from '$lib/trips';

const SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';

/**
 * Deep link that opens a place in Google Maps (app or web). Prefers exact
 * coordinates; falls back to a "Name, City" text search; null when there's
 * nothing to link.
 */
export function gmapsSearchUrl(place: {
	coords?: Coords;
	name?: string;
	city?: string;
}): string | null {
	if (place.coords) {
		return `${SEARCH_BASE}${encodeURIComponent(`${place.coords.lat},${place.coords.lng}`)}`;
	}
	const query = [place.name, place.city].filter(Boolean).join(', ');
	return query ? `${SEARCH_BASE}${encodeURIComponent(query)}` : null;
}
