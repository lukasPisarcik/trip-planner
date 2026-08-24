import { describe, expect, test } from 'bun:test';
import { gmapsSearchUrl } from './gmaps';

describe('gmapsSearchUrl', () => {
	test('name + coords → anchored place search (real listing, not a dropped pin)', () => {
		expect(gmapsSearchUrl({ name: 'Meiji Shrine', coords: { lat: 35.6764, lng: 139.6993 } })).toBe(
			'https://www.google.com/maps/search/Meiji%20Shrine/@35.6764,139.6993,17z'
		);
	});

	test('name + city + coords folds the city into the query', () => {
		expect(
			gmapsSearchUrl({ name: 'Wombats', city: 'Vienna', coords: { lat: 48.199, lng: 16.362 } })
		).toBe('https://www.google.com/maps/search/Wombats%2C%20Vienna/@48.199,16.362,17z');
	});

	test('name only → plain text search', () => {
		expect(gmapsSearchUrl({ name: 'Curry 36', city: 'Berlin' })).toBe(
			'https://www.google.com/maps/search/?api=1&query=Curry%2036%2C%20Berlin'
		);
	});

	test('coords only → dropped-pin fallback', () => {
		expect(gmapsSearchUrl({ coords: { lat: 48.21, lng: 16.38 } })).toBe(
			'https://www.google.com/maps/search/?api=1&query=48.21%2C16.38'
		);
	});

	test('nothing to link → null', () => {
		expect(gmapsSearchUrl({})).toBeNull();
	});

	test('query segment is URI-encoded (no raw slashes or CDATA terminators)', () => {
		const url = gmapsSearchUrl({ name: 'A/B ]]> café', coords: { lat: 1, lng: 2 } })!;
		expect(url).not.toContain(']]>');
		expect(url).toContain('A%2FB%20%5D%5D%3E%20caf%C3%A9');
	});
});
