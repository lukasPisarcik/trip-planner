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
	TipsTabSchema
} from '$lib/schemas';
import * as tripsService from '../services/trips.service';

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

const createTripTool = tool(
	'create_trip',
	'Create a brand-new trip. Provide the full Trip object. Slug must be unique.',
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
	'Replace the entire viral-spots tab payload.',
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

export const tripToolDefs = [
	getTripTool,
	updateTripFieldsTool,
	createTripTool,
	replaceItineraryTool,
	replaceTransportTool,
	replaceViralTool,
	replaceFlightsTool,
	replaceBudgetTool,
	replaceTipsTool
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
