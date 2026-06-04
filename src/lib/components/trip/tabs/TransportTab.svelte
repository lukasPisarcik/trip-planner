<script lang="ts">
	import type { TransportTab } from '$lib/trips';
	import Callout from '../Callout.svelte';
	import RouteCard from '../RouteCard.svelte';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: TransportTab } = $props();
</script>

<Callout html={data.callout} />

{#each data.groups as group, gi (gi)}
	<div class="route-group">
		<div class="route-group-title">{group.title}</div>
		{#each group.routes as route, ri (ri)}
			<RouteCard {route} />
		{/each}
	</div>
{/each}

<SectionNote html={data.note} />

<style>
	.route-group {
		margin-bottom: 28px;
	}
	.route-group-title {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #ffffff;
		background: var(--trip-accent, var(--sage));
		border-radius: 7px;
		padding: 7px 13px;
		margin-bottom: 10px;
		display: inline-block;
	}
</style>
