<script lang="ts">
	import type { TransportTab } from '$lib/trips';
	import Callout from '../Callout.svelte';
	import RouteCard from '../RouteCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: TransportTab } = $props();
</script>

<Callout html={data.callout} />

{#each data.groups as group, gi (gi)}
	<div class="mb-7">
		<div
			class="mb-2.5 inline-block rounded-[7px] bg-[var(--trip-accent,var(--sage))] px-[13px] py-[7px] text-[11px] font-bold tracking-[0.1em] text-white uppercase"
		>
			{group.title}
		</div>
		{#each group.routes as route, ri (ri)}
			<RouteCard {route} />
		{/each}
	</div>
{/each}

<SectionNote html={data.note} />
