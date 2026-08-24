// Whole-trip KML export. Serializes the map backdrop's spot set into a KML
// document — one <Folder> per category — that imports cleanly into Google
// My Maps (mymaps.google.com), which has no public API. Pure and DOM-free so
// it's Bun-testable; the download anchor lives in the map control (TripView).

import type { MapSpot, SpotCategory } from '$lib/components/trip/tabs/mapLayers';

const CATEGORY_LABEL: Record<SpotCategory, string> = {
	activity: 'Itinerary stops',
	restaurant: 'Food & drink',
	stay: 'Stays',
	viral: 'Viral spots'
};

const CATEGORY_ORDER: SpotCategory[] = ['activity', 'restaurant', 'stay', 'viral'];

/** Escape the five XML-special characters for element text content. */
export function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Serialize a trip's spots into a KML document, grouped into one folder per
 * category. KML coordinate order is `lng,lat` (the reverse of our MapSpot).
 */
export function tripKml(tripName: string, spots: MapSpot[]): string {
	const folders = CATEGORY_ORDER.map((category) => {
		const inCategory = spots.filter((s) => s.category === category);
		if (inCategory.length === 0) return '';
		const placemarks = inCategory
			.map(
				(s) =>
					`      <Placemark>\n` +
					`        <name>${escapeXml(s.icon ? `${s.icon} ${s.title}` : s.title)}</name>\n` +
					`        <Point><coordinates>${s.lng},${s.lat},0</coordinates></Point>\n` +
					`      </Placemark>`
			)
			.join('\n');
		return (
			`    <Folder>\n` +
			`      <name>${escapeXml(CATEGORY_LABEL[category])}</name>\n` +
			`${placemarks}\n` +
			`    </Folder>`
		);
	})
		.filter(Boolean)
		.join('\n');

	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
		`  <Document>\n` +
		`    <name>${escapeXml(tripName)}</name>\n` +
		`${folders}\n` +
		`  </Document>\n` +
		`</kml>\n`
	);
}
