// Google Maps deep-link builder. Pure and DOM-free so it's Bun-testable and
// usable from cards, info windows, and prompts alike. Plain Maps URLs are
// single-pin only — the whole-trip hand-off is the KML export (see kml.ts).

import type { Coords } from '$lib/trips';

const SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';

/**
 * Deep link that opens a place in Google Maps (app or web). With a name AND
 * coords it searches the name anchored at the spot (`/@lat,lng,17z`), which
 * resolves to the actual place listing — reviews, photos, hours — instead of a
 * bare dropped pin, while the anchor disambiguates chains and common names.
 * Name-only falls back to a plain text search, coords-only to a dropped pin;
 * null when there's nothing to link.
 */
export function gmapsSearchUrl(place: {
	coords?: Coords;
	name?: string;
	city?: string;
}): string | null {
	const query = [place.name, place.city].filter(Boolean).join(', ');
	if (query && place.coords) {
		return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${place.coords.lat},${place.coords.lng},17z`;
	}
	if (query) return `${SEARCH_BASE}${encodeURIComponent(query)}`;
	if (place.coords) {
		return `${SEARCH_BASE}${encodeURIComponent(`${place.coords.lat},${place.coords.lng}`)}`;
	}
	return null;
}
