<script lang="ts">
	import type { FlightsTab } from '$lib/trips';
	import FlightCard from '../FlightCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: FlightsTab } = $props();
</script>

<div class="mb-4 text-[10px] font-bold tracking-[0.12em] text-(--ink3) uppercase">
	{data.sectionLabel}
</div>

<div class="mb-5 grid grid-cols-1 gap-3 @xl:grid-cols-2">
	{#each data.primary as card, i (i)}
		<FlightCard {card} />
	{/each}
</div>

<div class="mb-5 grid grid-cols-1 gap-3 @xl:grid-cols-2">
	{#each data.secondary as card, i (i)}
		<FlightCard {card} />
	{/each}
</div>

<SectionNote html={data.note} marginTop="20px" />
