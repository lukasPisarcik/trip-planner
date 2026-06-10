<script lang="ts">
	import TripView from '$lib/components/trip/TripView.svelte';
	import { getTrip } from '$lib/remote/trips.remote';
	import type { Trip } from '$lib/trips';

	let { data } = $props();

	const tripQuery = $derived(getTrip({ slug: data.slug }));
	const trip = $derived<Trip>((tripQuery.current as Trip | null) ?? data.trip);
</script>

<svelte:head>
	<title>{trip.title}{trip.titleEmphasis ? ` ${trip.titleEmphasis}` : ''} · Trip Planner</title>
</svelte:head>

<TripView {trip} viewerMode={data.viewerMode ?? false} />
