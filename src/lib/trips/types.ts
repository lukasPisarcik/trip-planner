export type Accent = 'sage' | 'amber' | 'sky' | 'rose' | 'violet';

export type HeatLevel = 'fire' | 'hot' | 'rising';

export type ViralColor = 'fire' | 'orange' | 'sky' | 'violet';

export type TransportMode = 'bus' | 'train' | 'metro' | 'taxi';

export interface HeroPill {
	label: string;
	tone: Accent;
}

/** Geographic location of an itinerary stop, used to plot it on the day map. */
export interface Coords {
	lat: number;
	lng: number;
}

export interface ActivityItem {
	kind: 'activity';
	icon: string;
	title: string;
	description: string;
	tag?: string;
	/** When set, the stop appears as a numbered, connected marker on the day map. */
	coords?: Coords;
}

export interface LegItem {
	kind: 'leg';
	icon: string;
	title: string;
	description: string;
	price?: string;
	/** When set, the leg appears as a numbered, connected marker on the day map. */
	coords?: Coords;
}

export type DayItem = ActivityItem | LegItem;

export interface CountryHeader {
	flag: string;
	name: string;
	nights: string;
}

export interface Day {
	number: string | number;
	date: string;
	flag: string;
	title: string;
	subtitle: string;
	items: DayItem[];
	defaultOpen?: boolean;
	countryHeader?: CountryHeader;
}

export interface RouteStep {
	text: string;
}

export interface RouteChip {
	label: string;
	tone?: 'default' | 'warn' | 'good';
}

export interface TransportRoute {
	title: string;
	subtitle: string;
	mode: TransportMode;
	modeLabel: string;
	price: string;
	steps: RouteStep[];
	chips: RouteChip[];
	defaultOpen?: boolean;
}

export interface RouteGroup {
	title: string;
	routes: TransportRoute[];
}

export interface ViralSpot {
	color: ViralColor;
	heat: HeatLevel;
	icon: string;
	title: string;
	location: string;
	description: string;
	tags: string[];
	/** Set when imported from a TikTok/Instagram post — shows a source badge. */
	source?: RestaurantSource;
	socialUrl?: string;
	image?: {
		url: string;
		alt: string;
		credit?: string;
	};
}

export interface ViralSection {
	label: string;
	spots: ViralSpot[];
}

export type RestaurantCategory = 'food' | 'coffee' | 'bar';

export type RestaurantSource = 'tiktok' | 'instagram' | 'google' | 'local';

export type PriceLevel = '€' | '€€' | '€€€' | '€€€€';

export interface Restaurant {
	category: RestaurantCategory;
	name: string;
	location: string;
	description: string;
	cuisine?: string;
	priceLevel?: PriceLevel;
	rating: number;
	ratingCount: number;
	tags: string[];
	source?: RestaurantSource;
	socialUrl?: string;
	mapUrl?: string;
	image?: {
		url: string;
		alt: string;
		credit?: string;
	};
}

export interface RestaurantCity {
	city: string;
	flag?: string;
	places: Restaurant[];
}

export interface RestaurantsTab {
	callout: string;
	cities: RestaurantCity[];
	note: string;
}

export interface FlightInfoLine {
	label: string;
	value: string;
}

export interface FlightCard {
	heading: string;
	from?: string;
	to?: string;
	lines: FlightInfoLine[];
	price?: {
		label: string;
		value: string;
		note: string;
	};
}

export interface FlightsTab {
	sectionLabel: string;
	primary: FlightCard[];
	secondary: FlightCard[];
	note: string;
}

export interface BudgetRow {
	category: string;
	details: string;
	amount: string;
}

export interface BudgetVariant {
	id: string;
	label: string;
	total: string;
	daily: string;
	rows: BudgetRow[];
}

export interface BudgetTab {
	variants: BudgetVariant[];
	totalNote: string;
}

export interface TipCard {
	icon: string;
	title: string;
	body: string;
}

export interface TipsTab {
	sectionLabel: string;
	cards: TipCard[];
	note: string;
}

export interface ItineraryTab {
	callout: string;
	days: Day[];
}

export interface TransportTab {
	callout: string;
	groups: RouteGroup[];
	note: string;
}

export interface ViralTab {
	callout: string;
	sections: ViralSection[];
	note: string;
}

export interface CardPill {
	label: string;
}

export interface Trip {
	slug: string;
	title: string;
	titleEmphasis?: string;
	flag: string;
	flags: string[];
	accent: Accent;
	eyebrow: string;
	subtitle: string;
	dateRange: string;
	tagline: string;
	heroPills: HeroPill[];
	cardPills: CardPill[];
	highlights: string[];
	itinerary: ItineraryTab;
	transport: TransportTab;
	viral: ViralTab;
	flights: FlightsTab;
	budget: BudgetTab;
	tips: TipsTab;
	restaurants?: RestaurantsTab;
	/** Free-form scratchpad the user dumps ideas/findings into; read by the AI co-pilot. */
	brainstorm?: string;
	/** User-toggled favorite, surfaced in the sidebar Favorites section. */
	favorite?: boolean;
	/** Sidebar folder this trip belongs to; null/undefined = ungrouped. */
	folderId?: string | null;
}
