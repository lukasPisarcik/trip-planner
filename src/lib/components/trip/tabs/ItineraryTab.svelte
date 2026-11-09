<script lang="ts">
	import type { ItineraryTab } from '$lib/trips';
	import Callout from '../Callout.svelte';
	import CountryDivider from '../CountryDivider.svelte';
	import DayCard from '../DayCard.svelte';
	import { dayKey } from './mapLayers';

	let {
		data,
		focusedKey = null,
		colorVars = {},
		onfocuschange,
		scrollRequest = null,
		onscrolled
	}: {
		data: ItineraryTab;
		/** The map-focused day's key (null = all days). */
		focusedKey?: string | null;
		/** Day key → '--day-N' palette token for the drawn days. */
		colorVars?: Record<string, string>;
		/** A card opened/closed → focus (or unfocus) its day on the map. */
		onfocuschange?: (key: string | null) => void;
		/** One-shot: the day whose card should scroll into view (map/legend focus). */
		scrollRequest?: string | null;
		/** The card has scrolled — the parent clears the request. */
		onscrolled?: (key: string) => void;
	} = $props();
</script>

<Callout html={data.callout} />
{#each data.days as day (dayKey(day))}
	{#if day.countryHeader}
		<CountryDivider header={day.countryHeader} />
	{/if}
	<DayCard
		{day}
		focused={focusedKey === dayKey(day)}
		colorVar={colorVars[dayKey(day)]}
		{onfocuschange}
		scrollRequested={scrollRequest === dayKey(day)}
		{onscrolled}
	/>
{/each}
