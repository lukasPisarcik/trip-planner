import { z } from 'zod';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { log } from '$lib';
import {
	TripSchema,
	TripHeadlinePatchSchema,
	ItineraryTabSchema,
	TransportTabSchema,
	ViralTabSchema,
	FlightsTabSchema,
	BudgetTabSchema,
	TipsTabSchema,
	RestaurantsTabSchema,
	AskUserPayloadSchema
} from '$lib/schemas';
import * as tripsService from '../services/trips.service';
import { findWikimediaImage } from '../services/images.service';

function ok(text: string) {
	return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
	return { content: [{ type: 'text' as const, text }], isError: true };
}

const getTripTool = tool(
	'get_trip',
	'Fetch a trip by slug. Returns the full Trip JSON.',
	{ slug: z.string() },
	async ({ slug }) => {
		const trip = await tripsService.getTrip(slug);
		if (!trip) return err(`Trip "${slug}" not found`);
		return ok(JSON.stringify(trip, null, 2));
	}
);

const findImageTool = tool(
	'find_image',
	'Find a real, hotlinkable photo (Wikimedia Commons) for a place or landmark. Pass a specific ' +
		'query like "Gergeti Trinity Church, Kazbegi" or "Narisawa restaurant, Tokyo". Returns a JSON ' +
		'`{ url, alt, credit }` you can drop straight into a viral spot or restaurant `image`, or a ' +
		'"not found" message. Use this instead of WebSearch to get image URLs — never hand-write or ' +
		'guess `upload.wikimedia.org` URLs.',
	{ query: z.string() },
	async ({ query }) => {
		try {
			const image = await findWikimediaImage(query);
			return image
				? ok(JSON.stringify(image))
				: ok('No reliable image found — omit the image for this item.');
		} catch (e) {
			log.error({ err: e }, 'find_image failed');
			return err(e instanceof Error ? e.message : 'image lookup failed');
		}
	}
);

const updateTripFieldsTool = tool(
	'update_trip_fields',
	'Patch headline fields on a trip (title, tagline, dateRange, subtitle, eyebrow, accent, flag, flags, highlights, heroPills, cardPills, titleEmphasis). Omitted fields stay as-is.',
	{
		slug: z.string(),
		fields: TripHeadlinePatchSchema
	},
	async ({ slug, fields }) => {
		try {
			await tripsService.updateTripFields(slug, fields);
			return ok(`Updated ${Object.keys(fields).length} field(s) on ${slug}`);
		} catch (e) {
			log.error({ err: e }, 'update_trip_fields failed');
			return err(e instanceof Error ? e.message : 'update failed');
		}
	}
);

const askUserTool = tool(
	'ask_user',
	'Ask the traveler a batch of clarifying questions BEFORE planning — shown as an interactive ' +
		'in-chat form. Use single-select and multi-select questions with good preset options (and ' +
		'free-text only where options cannot capture the answer). After calling this tool you MUST end ' +
		'your turn immediately and wait — the user answers via the form and their answers arrive as the ' +
		'next message. Do NOT call any other tool in the same turn.',
	AskUserPayloadSchema.shape,
	async (args) => {
		for (const q of args.questions) {
			if ((q.kind === 'single' || q.kind === 'multi') && !q.options?.length) {
				return err(`Question "${q.id}" is ${q.kind} but has no options.`);
			}
		}
		return ok(
			'Questions presented to the traveler in an interactive form. They will reply with their ' +
				'answers as the next message. End your turn now — do not call more tools and do not keep talking.'
		);
	}
);

const createTripTool = tool(
	'create_trip',
	'Create a brand-new trip. Provide the full Trip object. Slug must be unique. Populate viral-spot ' +
		'and restaurant `image` fields by calling `find_image` per place (never hand-write image URLs), ' +
		'and set every restaurant `mapUrl` to a Google Maps search link.',
	TripSchema.shape,
	async (args) => {
		try {
			const id = await tripsService.createTrip(args);
			return ok(`Created trip "${args.slug}" (id: ${id})`);
		} catch (e) {
			log.error({ err: e }, 'create_trip failed');
			return err(e instanceof Error ? e.message : 'create failed');
		}
	}
);

const replaceItineraryTool = tool(
	'replace_itinerary',
	'Replace the entire itinerary tab payload (callout + days). Use when restructuring days.',
	{ slug: z.string(), payload: ItineraryTabSchema },
	async ({ slug, payload }) => {
		try {
			await tripsService.replaceTripTab(slug, 'itinerary', payload);
			return ok(`Replaced itinerary on ${slug}`);
		} catch (e) {
			return err(e instanceof Error ? e.message : 'replace failed');
		}
	}
);

const replaceTransportTool = tool(
	'replace_transport',
	'Replace the entire transport tab payload (callout + groups + note).',
	{ slug: z.string(), payload: TransportTabSchema },
	async ({ slug, payload }) => {
		try {
			await tripsService.replaceTripTab(slug, 'transport', payload);
			return ok(`Replaced transport on ${slug}`);
		} catch (e) {
			return err(e instanceof Error ? e.message : 'replace failed');
		}
	}
);

const replaceViralTool = tool(
	'replace_viral',
	'Replace the entire viral-spots tab payload. For each spot, call `find_image` to get a real, ' +
		'hotlinkable `image` and use what it returns; omit `image` only when `find_image` finds nothing. ' +
		'Never invent or hand-write an image URL.',
	{ slug: z.string(), payload: ViralTabSchema },
	async ({ slug, payload }) => {
		try {
			await tripsService.replaceTripTab(slug, 'viral', payload);
			return ok(`Replaced viral on ${slug}`);
		} catch (e) {
			return err(e instanceof Error ? e.message : 'replace failed');
		}
	}
);

const replaceFlightsTool = tool(
	'replace_flights',
	'Replace the entire flights tab payload.',
	{ slug: z.string(), payload: FlightsTabSchema },
	async ({ slug, payload }) => {
		try {
			await tripsService.replaceTripTab(slug, 'flights', payload);
			return ok(`Replaced flights on ${slug}`);
		} catch (e) {
			return err(e instanceof Error ? e.message : 'replace failed');
		}
	}
);

const replaceBudgetTool = tool(
	'replace_budget',
	'Replace the entire budget tab payload.',
	{ slug: z.string(), payload: BudgetTabSchema },
	async ({ slug, payload }) => {
		try {
			await tripsService.replaceTripTab(slug, 'budget', payload);
			return ok(`Replaced budget on ${slug}`);
		} catch (e) {
			return err(e instanceof Error ? e.message : 'replace failed');
		}
	}
);

const replaceTipsTool = tool(
	'replace_tips',
	'Replace the entire tips tab payload.',
	{ slug: z.string(), payload: TipsTabSchema },
	async ({ slug, payload }) => {
		try {
			await tripsService.replaceTripTab(slug, 'tips', payload);
			return ok(`Replaced tips on ${slug}`);
		} catch (e) {
			return err(e instanceof Error ? e.message : 'replace failed');
		}
	}
);

const replaceRestaurantsTool = tool(
	'replace_restaurants',
	'Replace the entire food & drink tab payload (callout + cities of restaurants, coffee shops & bars + note). Prefer spots with high ratings and many reviews; include trending TikTok/Instagram picks and nice coffee shops and bars, not only restaurants. Set every place `mapUrl` to a Google Maps search link (https://www.google.com/maps/search/?api=1&query=<URL-encoded "Name, City">), and call `find_image` to add a real, hotlinkable `image` where one exists (omit if it finds nothing; never hand-write image URLs).',
	{ slug: z.string(), payload: RestaurantsTabSchema },
	async ({ slug, payload }) => {
		try {
			await tripsService.replaceTripTab(slug, 'restaurants', payload);
			return ok(`Replaced restaurants on ${slug}`);
		} catch (e) {
			return err(e instanceof Error ? e.message : 'replace failed');
		}
	}
);

export const tripToolDefs = [
	getTripTool,
	findImageTool,
	askUserTool,
	updateTripFieldsTool,
	createTripTool,
	replaceItineraryTool,
	replaceTransportTool,
	replaceViralTool,
	replaceFlightsTool,
	replaceBudgetTool,
	replaceTipsTool,
	replaceRestaurantsTool
];

export const tripMcpServer = createSdkMcpServer({
	name: 'trip-planner',
	version: '0.1.0',
	tools: tripToolDefs
});

// Tool names as the SDK exposes them to the model: mcp__<server>__<tool>.
export const tripAllowedToolNames = tripToolDefs.map(
	(t) => `mcp__trip-planner__${t.name}` as const
);
