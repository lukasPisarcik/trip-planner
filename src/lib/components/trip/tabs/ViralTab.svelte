<script lang="ts">
	import type { ViralTab } from '$lib/trips';
	import Callout from '../Callout.svelte';
	import ViralCard from '../ViralCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: ViralTab } = $props();
</script>

<Callout html={data.callout} />

{#each data.sections as section, si (si)}
	<div class="mb-4 text-[10px] font-bold tracking-[0.12em] text-(--ink3) uppercase">
		{section.label}
	</div>
	<div class="mb-6 grid grid-cols-1 gap-2.5 @xl:grid-cols-2">
		{#each section.spots as spot, i (i)}
			<ViralCard {spot} />
		{/each}
	</div>
{/each}

<SectionNote html={data.note} />
