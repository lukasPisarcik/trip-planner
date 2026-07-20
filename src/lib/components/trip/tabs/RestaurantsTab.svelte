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
		<div
			class="mt-2 mb-3.5 flex items-center gap-2 border-b border-(--trip-border) pb-2 not-first:mt-7"
		>
			{#if city.flag}<span class="text-[20px] leading-none">{city.flag}</span>{/if}
			<span class="text-[16px] font-bold text-(--ink)">{city.city}</span>
		</div>

		{#each city.groups as group (group.category)}
			<div class="mb-3 text-[10px] font-bold tracking-[0.12em] text-(--ink3) uppercase">
				{categoryLabel[group.category]}
			</div>
			<div class="mb-[22px] grid grid-cols-[1fr_1fr] gap-2.5 max-[600px]:grid-cols-[1fr]">
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
