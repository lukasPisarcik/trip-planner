import { describe, expect, test } from 'bun:test';
import { DaySchema, TransportRouteSchema } from './schemas';

describe('defaultOpen is gone from the trip data model', () => {
	test('neither schema declares it', () => {
		expect('defaultOpen' in DaySchema.shape).toBe(false);
		expect('defaultOpen' in TransportRouteSchema.shape).toBe(false);
	});

	test('a stale stored day loses the key on parse', () => {
		const day = DaySchema.parse({
			number: 1,
			date: 'Dec 18',
			flag: '🇯🇵',
			title: 'Arrive',
			subtitle: 'Tokyo',
			items: [],
			defaultOpen: true
		});
		expect(day).not.toHaveProperty('defaultOpen');
	});

	test('a stale stored route loses the key on parse', () => {
		const route = TransportRouteSchema.parse({
			title: 'Tokyo → Kyoto',
			subtitle: 'Shinkansen Nozomi',
			mode: 'train',
			modeLabel: 'Train',
			price: '¥13,320',
			steps: [{ text: 'Board at Tokyo Station' }],
			chips: [{ label: '2h 15m' }],
			defaultOpen: true
		});
		expect(route).not.toHaveProperty('defaultOpen');
	});
});
