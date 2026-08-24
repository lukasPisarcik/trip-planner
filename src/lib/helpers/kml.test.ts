import { describe, expect, test } from 'bun:test';
import { escapeXml, tripKml } from './kml';
import type { MapSpot } from '$lib/components/trip/tabs/mapLayers';

const spots: MapSpot[] = [
	{ lat: 52.52, lng: 13.4, title: 'Museum & Gallery', category: 'activity', icon: '🏛' },
	{ lat: 52.49, lng: 13.39, title: 'Curry <36>', category: 'restaurant' },
	{ lat: 52.53, lng: 13.41, title: 'Circus Hostel', category: 'stay' },
	{ lat: 52.51, lng: 13.38, title: 'Rooftop', category: 'viral', icon: '🔥' }
];

describe('escapeXml', () => {
	test('escapes all five XML-special characters', () => {
		expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
	});

	test('leaves plain text untouched', () => {
		expect(escapeXml('Café São 🏛')).toBe('Café São 🏛');
	});
});

describe('tripKml', () => {
	const kml = tripKml('Berlin & Beyond', spots);

	test('is a well-formed KML skeleton with the escaped trip name', () => {
		expect(kml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
		expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
		expect(kml).toContain('<name>Berlin &amp; Beyond</name>');
	});

	test('groups spots into one folder per category', () => {
		expect(kml).toContain('<name>Itinerary stops</name>');
		expect(kml).toContain('<name>Food &amp; drink</name>');
		expect(kml).toContain('<name>Stays</name>');
		expect(kml).toContain('<name>Viral spots</name>');
		expect(kml.match(/<Folder>/g)).toHaveLength(4);
		expect(kml.match(/<Placemark>/g)).toHaveLength(4);
	});

	test('omits folders for empty categories', () => {
		const only = tripKml('Solo', [spots[0]]);
		expect(only.match(/<Folder>/g)).toHaveLength(1);
		expect(only).not.toContain('<name>Stays</name>');
	});

	test('coordinates are lng,lat (KML order)', () => {
		expect(kml).toContain('<coordinates>13.41,52.53,0</coordinates>');
		expect(kml).not.toContain('<coordinates>52.53,13.41');
	});

	test('escapes markup in place names', () => {
		expect(kml).toContain('Curry &lt;36&gt;');
		expect(kml).not.toContain('Curry <36>');
	});

	test('placemark names keep the spot icon prefix', () => {
		expect(kml).toContain('<name>🔥 Rooftop</name>');
	});
});
