import z from 'zod';

// =============================================================================
// Common input schema for remote functions / forms that take no params.
// =============================================================================

export const EmptyInput = z.object({});
export type EmptyInput = z.infer<typeof EmptyInput>;

// =============================================================================
// UI primitives (used by toast helper).
// =============================================================================

export const ToastVariant = z.enum(['default', 'success', 'error', 'warning', 'info']);
export type ToastVariant = z.infer<typeof ToastVariant>;

// =============================================================================
// Theme (used by themeStore).
// =============================================================================

export const ThemeSchema = z.enum(['light', 'dark']);
export type Theme = z.infer<typeof ThemeSchema>;

// =============================================================================
// UUID
// =============================================================================

export const UUID = z.uuid();

// =============================================================================
// Error page categories (used by +error.svelte and src/lib/errors/page.ts).
// =============================================================================

export const ErrorCategory = z.enum([
	'auth',
	'forbidden',
	'not_found',
	'validation',
	'server',
	'unknown'
]);
export type ErrorCategory = z.infer<typeof ErrorCategory>;

export interface ErrorMetadata {
	category: ErrorCategory;
	titleKey: string;
	descriptionKey: string;
	whatHappenedKey: string;
	whatToDoKey: string;
	showRetry: boolean;
	showHome: boolean;
	showSupport: boolean;
}

// =============================================================================
// Add your domain schemas below this line.
// Convention: every Zod schema lives in this file (one source of truth).
// See `.claude/docs/schemas.md` for details.
// =============================================================================

// =============================================================================
// Trip schemas — mirror of src/lib/trips/types.ts. Gate every write through
// the trips service to the local JSON store.
// =============================================================================

export const AccentSchema = z.enum(['sage', 'amber', 'sky', 'rose', 'violet']);
export const HeatLevelSchema = z.enum(['fire', 'hot', 'rising']);
export const ViralColorSchema = z.enum(['fire', 'orange', 'sky', 'violet']);
export const TransportModeSchema = z.enum(['bus', 'train', 'metro', 'taxi']);

export const HeroPillSchema = z.object({
	label: z.string(),
	tone: AccentSchema
});

export const CoordsSchema = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180)
});

export const ActivityItemSchema = z.object({
	kind: z.literal('activity'),
	icon: z.string(),
	title: z.string(),
	description: z.string(),
	tag: z.string().optional(),
	coords: CoordsSchema.optional()
});

export const LegItemSchema = z.object({
	kind: z.literal('leg'),
	icon: z.string(),
	title: z.string(),
	description: z.string(),
	price: z.string().optional(),
	coords: CoordsSchema.optional()
});

export const DayItemSchema = z.discriminatedUnion('kind', [ActivityItemSchema, LegItemSchema]);

export const CountryHeaderSchema = z.object({
	flag: z.string(),
	name: z.string(),
	nights: z.string()
});

export const DaySchema = z.object({
	number: z.union([z.string(), z.number()]),
	date: z.string(),
	flag: z.string(),
	title: z.string(),
	subtitle: z.string(),
	items: z.array(DayItemSchema),
	defaultOpen: z.boolean().optional(),
	countryHeader: CountryHeaderSchema.optional()
});

export const RouteStepSchema = z.object({ text: z.string() });

export const RouteChipSchema = z.object({
	label: z.string(),
	tone: z.enum(['default', 'warn', 'good']).optional()
});

export const TransportRouteSchema = z.object({
	title: z.string(),
	subtitle: z.string(),
	mode: TransportModeSchema,
	modeLabel: z.string(),
	price: z.string(),
	steps: z.array(RouteStepSchema),
	chips: z.array(RouteChipSchema),
	defaultOpen: z.boolean().optional()
});

export const RouteGroupSchema = z.object({
	title: z.string(),
	routes: z.array(TransportRouteSchema)
});

export const ViralSpotSchema = z.object({
	color: ViralColorSchema,
	heat: HeatLevelSchema,
	icon: z.string(),
	title: z.string(),
	location: z.string(),
	description: z.string(),
	tags: z.array(z.string()),
	image: z
		.object({
			url: z.url(),
			alt: z.string(),
			credit: z.string().optional()
		})
		.optional()
});

export const ViralSectionSchema = z.object({
	label: z.string(),
	spots: z.array(ViralSpotSchema)
});

export const RestaurantCategorySchema = z.enum(['food', 'coffee', 'bar']);
export const RestaurantSourceSchema = z.enum(['tiktok', 'instagram', 'google', 'local']);
export const PriceLevelSchema = z.enum(['€', '€€', '€€€', '€€€€']);

export const RestaurantSchema = z.object({
	category: RestaurantCategorySchema,
	name: z.string(),
	location: z.string(),
	description: z.string(),
	cuisine: z.string().optional(),
	priceLevel: PriceLevelSchema.optional(),
	rating: z.number().min(0).max(5),
	ratingCount: z.number().int().min(0),
	tags: z.array(z.string()),
	source: RestaurantSourceSchema.optional(),
	socialUrl: z.url().optional(),
	mapUrl: z.url().optional(),
	image: z
		.object({
			url: z.url(),
			alt: z.string(),
			credit: z.string().optional()
		})
		.optional()
});

export const RestaurantCitySchema = z.object({
	city: z.string(),
	flag: z.string().optional(),
	places: z.array(RestaurantSchema)
});

export const RestaurantsTabSchema = z.object({
	callout: z.string(),
	cities: z.array(RestaurantCitySchema),
	note: z.string()
});

export const FlightInfoLineSchema = z.object({
	label: z.string(),
	value: z.string()
});

export const FlightCardSchema = z.object({
	heading: z.string(),
	from: z.string().optional(),
	to: z.string().optional(),
	lines: z.array(FlightInfoLineSchema),
	price: z
		.object({
			label: z.string(),
			value: z.string(),
			note: z.string()
		})
		.optional()
});

export const FlightsTabSchema = z.object({
	sectionLabel: z.string(),
	primary: z.array(FlightCardSchema),
	secondary: z.array(FlightCardSchema),
	note: z.string()
});

export const BudgetRowSchema = z.object({
	category: z.string(),
	details: z.string(),
	amount: z.string()
});

export const BudgetVariantSchema = z.object({
	id: z.string(),
	label: z.string(),
	total: z.string(),
	daily: z.string(),
	rows: z.array(BudgetRowSchema)
});

export const BudgetTabSchema = z.object({
	variants: z.array(BudgetVariantSchema),
	totalNote: z.string()
});

export const TipCardSchema = z.object({
	icon: z.string(),
	title: z.string(),
	body: z.string()
});

export const TipsTabSchema = z.object({
	sectionLabel: z.string(),
	cards: z.array(TipCardSchema),
	note: z.string()
});

export const ItineraryTabSchema = z.object({
	callout: z.string(),
	days: z.array(DaySchema)
});

export const TransportTabSchema = z.object({
	callout: z.string(),
	groups: z.array(RouteGroupSchema),
	note: z.string()
});

export const ViralTabSchema = z.object({
	callout: z.string(),
	sections: z.array(ViralSectionSchema),
	note: z.string()
});

export const CardPillSchema = z.object({ label: z.string() });

// Free-form brainstorm notes (a single text blob). The co-pilot reads it for context.
export const BrainstormSchema = z.string();

export const TripSchema = z.object({
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/),
	title: z.string().min(1),
	titleEmphasis: z.string().optional(),
	flag: z.string(),
	flags: z.array(z.string()),
	accent: AccentSchema,
	eyebrow: z.string(),
	subtitle: z.string(),
	dateRange: z.string(),
	tagline: z.string(),
	heroPills: z.array(HeroPillSchema),
	cardPills: z.array(CardPillSchema),
	highlights: z.array(z.string()),
	itinerary: ItineraryTabSchema,
	transport: TransportTabSchema,
	viral: ViralTabSchema,
	flights: FlightsTabSchema,
	budget: BudgetTabSchema,
	tips: TipsTabSchema,
	restaurants: RestaurantsTabSchema.optional(),
	brainstorm: BrainstormSchema.optional(),
	// User-toggled favorite (shown in the sidebar Favorites section). Optional so
	// existing stored trips and the committed snapshot parse unchanged. The AI
	// can't set it — it's excluded from TripHeadlinePatchSchema below.
	favorite: z.boolean().optional(),
	// Sidebar folder this trip belongs to (null/absent = ungrouped). Optional +
	// nullable so existing stored trips, the snapshot, and AI-created trips parse
	// unchanged. The AI never sets it — moves go through the moveTripToFolder
	// command, not TripHeadlinePatchSchema.
	folderId: z.string().nullable().optional()
});

// Headline-only fields the AI co-pilot can patch with the `update_trip_fields` tool.
export const TripHeadlinePatchSchema = TripSchema.pick({
	title: true,
	titleEmphasis: true,
	tagline: true,
	dateRange: true,
	subtitle: true,
	eyebrow: true,
	accent: true,
	flag: true,
	flags: true,
	highlights: true,
	heroPills: true,
	cardPills: true
}).partial();

export type TripHeadlinePatch = z.infer<typeof TripHeadlinePatchSchema>;

// =============================================================================
// Sidebar folders (one level — folders group trips, trips can't nest folders).
// =============================================================================

// Public folder shape. `id` is a slug so it's URL/JSON-safe; the persisted
// record adds a `createdAt` (stripped before reaching callers), mirroring trips.
export const FolderSchema = z.object({
	id: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/),
	name: z.string().min(1).max(60)
});
export type Folder = z.infer<typeof FolderSchema>;

export const CreateFolderInput = z.object({ name: z.string().min(1).max(60) });
export const RenameFolderInput = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(60)
});
export const FolderIdInput = z.object({ id: z.string().min(1) });
export const MoveTripToFolderInput = z.object({
	slug: z.string().min(1),
	// null = move to the ungrouped "Trips" section.
	folderId: z.string().min(1).nullable()
});

// =============================================================================
// AI chat schemas.
// =============================================================================

// `thinking` carries the model's streamed reasoning (rendered as a collapsible
// block). `tool` messages store a friendly summary in `content` and an optional
// plain-language `detail` — never raw JSON. `error` marks a turn that failed
// before producing any reply, so reloads show what happened instead of a
// dangling, unanswered user message.
export const ChatRoleSchema = z.enum(['user', 'assistant', 'tool', 'thinking', 'error']);

export const ChatMessageSchema = z.object({
	id: z.string(),
	role: ChatRoleSchema,
	content: z.string(),
	toolName: z.string().optional(),
	// Expandable plain-language summary for tool messages (and reusable elsewhere).
	detail: z.string().optional(),
	createdAt: z.number()
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// =============================================================================
// Claude model selection (standalone agent view + composer dropdown).
// Vendor-agnostic shape so non-Claude providers could be added later, but the
// Claude Agent SDK is Claude-only for now. The route falls back to the
// `ANTHROPIC_MODEL` env var when no (or an unknown) model is supplied.
// =============================================================================

export const ChatModelSchema = z.enum([
	'claude-opus-4-8',
	'claude-sonnet-4-6',
	'claude-haiku-4-5-20251001'
]);
export type ChatModel = z.infer<typeof ChatModelSchema>;

export const CHAT_MODELS: ReadonlyArray<{ id: ChatModel; label: string; blurb: string }> = [
	{ id: 'claude-opus-4-8', label: 'Opus 4.8', blurb: 'Most capable' },
	{ id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', blurb: 'Balanced' },
	{ id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', blurb: 'Fastest' }
];

export const DEFAULT_CHAT_MODEL: ChatModel = 'claude-sonnet-4-6';

export const ChatRequestSchema = z.object({
	tripSlug: z.string().nullable(),
	message: z.string().min(1),
	model: ChatModelSchema.optional(),
	// Session to resume. Absent → a brand-new conversation is created. The client
	// learns the id from the `session` SSE event and sends it on follow-up turns.
	sessionId: z.string().optional()
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
