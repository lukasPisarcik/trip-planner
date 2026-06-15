// Human-friendly rendering of agent tool calls. The chat UI must never show raw
// JSON for a tool's input — instead we surface a short label, a "pending" gerund
// for the live status line, and an optional plain-language detail. This is the
// single source of truth, used server-side (to build SSE payloads + persisted
// messages) and client-side (to re-render persisted history). Pure + defensive:
// inputs are treated as untyped because they arrive from the model.

export interface ToolDisplay {
	/** Leading emoji for the chip. */
	icon: string;
	/** Past-tense result label, e.g. "Created trip: Paris 🇫🇷". */
	label: string;
	/** Present-progressive status while the tool runs, e.g. "Creating your trip…". */
	pending: string;
	/** Expandable plain-language summary. Never JSON. */
	detail?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined;
}

function count(value: unknown): number {
	return asArray(value).length;
}

function plural(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** Join non-empty fragments with " · ". */
function dotted(...parts: Array<string | undefined>): string | undefined {
	const kept = parts.filter((p): p is string => !!p);
	return kept.length ? kept.join(' · ') : undefined;
}

export function formatTool(name: string, input: unknown): ToolDisplay {
	const args = asRecord(input);

	switch (name) {
		case 'create_trip': {
			const title = str(args.title) ?? str(args.slug) ?? 'trip';
			const flag = str(args.flag) ?? '';
			const days = count(asRecord(args.itinerary).days);
			const cities = count(asRecord(args.restaurants).cities);
			return {
				icon: '✨',
				label: `Created trip: ${title}${flag ? ' ' + flag : ''}`,
				pending: 'Creating your trip…',
				detail: dotted(
					days ? plural(days, 'day') : undefined,
					cities ? plural(cities, 'city', 'cities') + ' of food spots' : undefined
				)
			};
		}
		case 'update_trip_fields': {
			const fields = Object.keys(asRecord(args.fields));
			return {
				icon: '✏️',
				label: 'Updated trip details',
				pending: 'Updating trip details…',
				detail: fields.length ? `Changed: ${fields.join(', ')}` : undefined
			};
		}
		case 'replace_itinerary': {
			const days = count(asRecord(args.payload).days);
			return {
				icon: '🗺️',
				label: 'Rebuilt the itinerary',
				pending: 'Rebuilding the itinerary…',
				detail: days ? plural(days, 'day') : undefined
			};
		}
		case 'replace_transport': {
			const groups = asArray(asRecord(args.payload).groups);
			const routes = groups.reduce<number>((sum, g) => sum + count(asRecord(g).routes), 0);
			return {
				icon: '🚆',
				label: 'Updated transport',
				pending: 'Planning transport…',
				detail: dotted(
					groups.length ? plural(groups.length, 'group') : undefined,
					routes ? plural(routes, 'route') : undefined
				)
			};
		}
		case 'replace_viral': {
			const sections = asArray(asRecord(args.payload).sections);
			const spots = sections.reduce<number>((sum, s) => sum + count(asRecord(s).spots), 0);
			return {
				icon: '🔥',
				label: 'Updated viral spots',
				pending: 'Finding viral spots…',
				detail: spots ? plural(spots, 'spot') : undefined
			};
		}
		case 'replace_flights': {
			const p = asRecord(args.payload);
			const flights = count(p.primary) + count(p.secondary);
			return {
				icon: '✈️',
				label: 'Updated flights',
				pending: 'Checking flights…',
				detail: flights ? plural(flights, 'option') : undefined
			};
		}
		case 'replace_budget': {
			const variants = count(asRecord(args.payload).variants);
			return {
				icon: '💶',
				label: 'Updated the budget',
				pending: 'Working out the budget…',
				detail: variants ? plural(variants, 'budget option') : undefined
			};
		}
		case 'replace_tips': {
			const cards = count(asRecord(args.payload).cards);
			return {
				icon: '💡',
				label: 'Updated tips',
				pending: 'Writing tips…',
				detail: cards ? plural(cards, 'tip') : undefined
			};
		}
		case 'replace_restaurants': {
			const cities = asArray(asRecord(args.payload).cities);
			const places = cities.reduce<number>((sum, c) => sum + count(asRecord(c).places), 0);
			return {
				icon: '🍽️',
				label: 'Updated food & drink',
				pending: 'Picking restaurants…',
				detail: dotted(
					places ? plural(places, 'spot') : undefined,
					cities.length ? `across ${plural(cities.length, 'city', 'cities')}` : undefined
				)
			};
		}
		case 'get_trip':
			return {
				icon: '📖',
				label: 'Reviewed the current trip',
				pending: 'Reading the trip…'
			};
		case 'WebSearch': {
			const q = str(args.query);
			return {
				icon: '🔎',
				label: q ? `Searched: ${q}` : 'Searched the web',
				pending: 'Searching the web…'
			};
		}
		case 'WebFetch': {
			const url = str(args.url);
			let host: string | undefined;
			if (url) {
				try {
					host = new URL(url).hostname.replace(/^www\./, '');
				} catch {
					host = url;
				}
			}
			return {
				icon: '🌐',
				label: host ? `Read ${host}` : 'Read a page',
				pending: 'Reading a page…'
			};
		}
		default:
			return {
				icon: '🔧',
				label: name.replace(/_/g, ' '),
				pending: 'Working…'
			};
	}
}
