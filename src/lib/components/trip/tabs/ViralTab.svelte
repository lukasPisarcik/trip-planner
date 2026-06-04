<script lang="ts">
	import type { ViralTab } from '$lib/trips';
	import Callout from '../Callout.svelte';
	import ViralCard from '../ViralCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: ViralTab } = $props();
</script>

<Callout html={data.callout} />

{#each data.sections as section, si (si)}
	<div class="section-label">{section.label}</div>
	<div class="viral-grid">
		{#each section.spots as spot, i (i)}
			<ViralCard {spot} />
		{/each}
	</div>
{/each}

<SectionNote html={data.note} />

<style>
	.section-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-bottom: 16px;
	}
	.viral-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 24px;
	}
	@media (max-width: 600px) {
		.viral-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
