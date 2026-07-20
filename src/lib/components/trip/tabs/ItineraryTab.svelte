<script lang="ts">
	import type { Day, ItineraryTab } from '$lib/trips';
	import Callout from '../Callout.svelte';
	import CountryDivider from '../CountryDivider.svelte';
	import DayCard from '../DayCard.svelte';

	let { data, onfocusday }: { data: ItineraryTab; onfocusday?: (day: Day) => void } = $props();
</script>

<Callout html={data.callout} />
{#each data.days as day (`${day.number}-${day.date}`)}
	{#if day.countryHeader}
		<CountryDivider header={day.countryHeader} />
	{/if}
	<DayCard {day} {onfocusday} />
{/each}
