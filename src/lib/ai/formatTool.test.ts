import { describe, expect, test } from 'bun:test';
import { formatTool } from './formatTool';

describe('formatTool', () => {
	test('create_trip surfaces title, flag and day/city counts — no JSON', () => {
		const d = formatTool('create_trip', {
			slug: 'paris',
			title: 'Paris',
			flag: '🇫🇷',
			itinerary: { days: [{}, {}, {}] },
			restaurants: { cities: [{}, {}] }
		});
		expect(d.label).toBe('Created trip: Paris 🇫🇷');
		expect(d.pending).toBe('Creating your trip…');
		expect(d.detail).toContain('3 days');
		expect(d.detail).toContain('2 cities');
		// Never leak raw JSON into any user-facing string.
		expect(`${d.label} ${d.detail}`).not.toContain('{');
	});

	test('update_trip_fields lists changed field names', () => {
		const d = formatTool('update_trip_fields', {
			slug: 'paris',
			fields: { title: 'X', tagline: 'Y' }
		});
		expect(d.label).toBe('Updated trip details');
		expect(d.detail).toBe('Changed: title, tagline');
	});

	test('replace_itinerary counts days from the payload', () => {
		const d = formatTool('replace_itinerary', { slug: 'paris', payload: { days: [{}, {}] } });
		expect(d.detail).toBe('2 days');
	});

	test('replace_restaurants aggregates places across cities', () => {
		const d = formatTool('replace_restaurants', {
			slug: 'paris',
			payload: { cities: [{ places: [{}, {}] }, { places: [{}] }] }
		});
		expect(d.detail).toContain('3 spots');
		expect(d.detail).toContain('2 cities');
	});

	test('singular vs plural wording', () => {
		const one = formatTool('replace_itinerary', { payload: { days: [{}] } });
		expect(one.detail).toBe('1 day');
	});

	test('WebSearch shows the query', () => {
		const d = formatTool('WebSearch', { query: 'best pastéis de nata Lisbon' });
		expect(d.icon).toBe('🔎');
		expect(d.label).toBe('Searched: best pastéis de nata Lisbon');
		expect(d.pending).toBe('Searching the web…');
	});

	test('WebFetch shows the host without www', () => {
		const d = formatTool('WebFetch', {
			url: 'https://www.timeout.com/lisbon/restaurants',
			prompt: 'x'
		});
		expect(d.icon).toBe('🌐');
		expect(d.label).toBe('Read timeout.com');
	});

	test('WebFetch with a bad url never throws', () => {
		expect(() => formatTool('WebFetch', { url: 'not a url' })).not.toThrow();
	});

	test('unknown tool degrades gracefully without throwing', () => {
		const d = formatTool('mystery_tool', undefined);
		expect(d.icon).toBeTruthy();
		expect(d.label).toBe('mystery tool');
		expect(d.pending).toBeTruthy();
	});

	test('missing/partial input never throws', () => {
		expect(() => formatTool('create_trip', null)).not.toThrow();
		expect(() => formatTool('replace_transport', {})).not.toThrow();
	});
});
