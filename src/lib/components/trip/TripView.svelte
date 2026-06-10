<script lang="ts">
	import type { Trip } from '$lib/trips';
	import Hero from './Hero.svelte';
	import TabBar from './TabBar.svelte';
	import ItineraryTab from './tabs/ItineraryTab.svelte';
	import TransportTab from './tabs/TransportTab.svelte';
	import ViralTab from './tabs/ViralTab.svelte';
	import FlightsTab from './tabs/FlightsTab.svelte';
	import BudgetTab from './tabs/BudgetTab.svelte';
	import TipsTab from './tabs/TipsTab.svelte';
	import RestaurantsTab from './tabs/RestaurantsTab.svelte';
	import BrainstormTab from './tabs/BrainstormTab.svelte';

	let { trip, viewerMode = false }: { trip: Trip; viewerMode?: boolean } = $props();

	const allTabs = [
		{ id: 'brainstorm', label: '💭 Brainstorm' },
		{ id: 'itinerary', label: '📅 Itinerary' },
		{ id: 'transport', label: '🚌 Transport' },
		{ id: 'viral', label: '📸 Viral Spots' },
		{ id: 'restaurants', label: '🍽️ Food & Drink' },
		{ id: 'flights', label: '✈️ Flights' },
		{ id: 'budget', label: '💶 Budget' },
		{ id: 'tips', label: '💡 Tips' }
	];

	// Brainstorm is a private planning scratchpad (and the only editable tab) —
	// hide it on read-only public deployments.
	const tabs = $derived(viewerMode ? allTabs.filter((t) => t.id !== 'brainstorm') : allTabs);

	let active = $state('itinerary');

	const accentStrong: Record<Trip['accent'], string> = {
		sage: '#86efac',
		rose: '#fda4af',
		amber: '#fde68a',
		sky: '#bae6fd',
		violet: '#ddd6fe'
	};

	const styleVars = $derived(
		[
			`--trip-accent: var(--${trip.accent})`,
			`--trip-accent-lt: var(--${trip.accent}-lt)`,
			`--trip-accent-md: var(--${trip.accent}-md)`,
			`--trip-accent-strong: ${accentStrong[trip.accent]}`
		].join('; ')
	);
</script>

<div class="trip-root" style={styleVars}>
	<Hero {trip} />
	<TabBar {tabs} {active} onselect={(id) => (active = id)} />

	<div class="content">
		{#if active === 'brainstorm'}
			<BrainstormTab slug={trip.slug} content={trip.brainstorm} />
		{:else if active === 'itinerary'}
			<ItineraryTab data={trip.itinerary} />
		{:else if active === 'transport'}
			<TransportTab data={trip.transport} />
		{:else if active === 'viral'}
			<ViralTab data={trip.viral} />
		{:else if active === 'restaurants'}
			<RestaurantsTab data={trip.restaurants} />
		{:else if active === 'flights'}
			<FlightsTab data={trip.flights} />
		{:else if active === 'budget'}
			<BudgetTab data={trip.budget} />
		{:else if active === 'tips'}
			<TipsTab data={trip.tips} />
		{/if}
	</div>
</div>

<style>
	.content {
		max-width: 860px;
		margin: 0 auto;
		padding: 36px 40px;
		font-size: 14px;
		line-height: 1.6;
	}
	@media (max-width: 640px) {
		.content {
			padding: 24px 16px;
		}
	}
</style>
