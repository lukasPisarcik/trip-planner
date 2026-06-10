<script lang="ts">
	import type { RestaurantsTab, Restaurant, RestaurantCategory } from '$lib/trips';
	import Callout from '../Callout.svelte';
	import RestaurantCard from '../RestaurantCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: RestaurantsTab | undefined } = $props();

	const CATEGORY_ORDER: RestaurantCategory[] = ['food', 'coffee', 'bar'];
	const categoryLabel: Record<RestaurantCategory, string> = {
		food: '🍽️ Restaurants',
		coffee: '☕ Coffee',
		bar: '🍸 Bars'
	};

	// Rank by both quality and popularity: a high rating with many reviews beats
	// a perfect rating with only a handful. log10 dampens the review-count weight.
	function score(p: Restaurant): number {
		return p.rating * Math.log10(p.ratingCount + 10);
	}

	const cities = $derived(
		(data?.cities ?? [])
			.map((c) => ({
				city: c.city,
				flag: c.flag,
				groups: CATEGORY_ORDER.map((category) => ({
					category,
					places: c.places
						.filter((p) => p.category === category)
						.sort((a, b) => score(b) - score(a))
				})).filter((g) => g.places.length > 0)
			}))
			.filter((c) => c.groups.length > 0)
	);
</script>

{#if cities.length === 0}
	<Callout
		html="🍽️ <strong>No food &amp; drink picks yet.</strong> Ask the co-pilot to add the best restaurants, coffee shops, and bars — high-rated spots plus trending TikTok &amp; Instagram finds."
	/>
{:else}
	{#if data?.callout}
		<Callout html={data.callout} />
	{/if}

	{#each cities as city, ci (ci)}
		<div class="city-header">
			{#if city.flag}<span class="city-flag">{city.flag}</span>{/if}
			<span class="city-name">{city.city}</span>
		</div>

		{#each city.groups as group (group.category)}
			<div class="cat-label">{categoryLabel[group.category]}</div>
			<div class="rest-grid">
				{#each group.places as place, i (i)}
					<RestaurantCard {place} />
				{/each}
			</div>
		{/each}
	{/each}

	{#if data?.note}
		<SectionNote html={data.note} marginTop="8px" />
	{/if}
{/if}

<style>
	.city-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px 0 14px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--trip-border);
	}
	.city-header:not(:first-child) {
		margin-top: 28px;
	}
	.city-flag {
		font-size: 20px;
		line-height: 1;
	}
	.city-name {
		font-size: 16px;
		font-weight: 700;
		color: var(--ink);
	}
	.cat-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-bottom: 12px;
	}
	.rest-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 22px;
	}
	@media (max-width: 600px) {
		.rest-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
