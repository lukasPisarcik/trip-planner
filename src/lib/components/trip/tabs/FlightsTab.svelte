<script lang="ts">
	import type { FlightsTab } from '$lib/trips';
	import FlightCard from '../FlightCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: FlightsTab } = $props();
</script>

<div class="section-label">{data.sectionLabel}</div>

<div class="flights-grid">
	{#each data.primary as card, i (i)}
		<FlightCard {card} />
	{/each}
</div>

<div class="flights-grid">
	{#each data.secondary as card, i (i)}
		<FlightCard {card} />
	{/each}
</div>

<SectionNote html={data.note} marginTop="20px" />

<style>
	.section-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-bottom: 16px;
	}
	.flights-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 20px;
	}
	@media (max-width: 580px) {
		.flights-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
