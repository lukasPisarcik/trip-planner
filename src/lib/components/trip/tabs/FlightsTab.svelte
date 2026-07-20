<script lang="ts">
	import type { FlightsTab } from '$lib/trips';
	import FlightCard from '../FlightCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: FlightsTab } = $props();
</script>

<div class="mb-4 text-[10px] font-bold tracking-[0.12em] text-(--ink3) uppercase">
	{data.sectionLabel}
</div>

<div class="mb-5 grid grid-cols-[1fr_1fr] gap-3 max-[580px]:grid-cols-[1fr]">
	{#each data.primary as card, i (i)}
		<FlightCard {card} />
	{/each}
</div>

<div class="mb-5 grid grid-cols-[1fr_1fr] gap-3 max-[580px]:grid-cols-[1fr]">
	{#each data.secondary as card, i (i)}
		<FlightCard {card} />
	{/each}
</div>

<SectionNote html={data.note} marginTop="20px" />
